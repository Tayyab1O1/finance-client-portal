import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const CLICKUP_API = "https://api.clickup.com/api/v2";
const CLIENTS_SPACE_ID = "901811345157";
const MONTHLY_WORK_LIST_NAME = "Monthly Work - Recurring";
const TEMPLATE_FOLDER_PREFIX = "_TEMPLATE";

// Custom field IDs — used to resolve dropdown values by name
const CUSTOM_FIELD_IDS = {
  client: "08e142fa-1422-4d1d-9843-8fe571611382",
  cadence: "6a1d8807-2bad-4d80-bb1d-a87a6052e94a",
  responsibility: "74d6751b-99f8-4154-883c-25a88310b126",
  listType: "9bdcf8db-48f2-4f1d-b145-2ecce6693cdf",
  taskType: "c5e94f21-707b-44a5-9f41-4f13674293f4",
  workMonth: "c53fcf6f-88f2-4240-abbb-d12ba7fdf3fe",
  workYear: "50817c41-16c3-4340-9523-46648001d141",
  approvalRequired: "b5f48ab4-f8f4-494e-b30c-68f6a7e15e9c",
};

interface ClickUpFolder {
  id: string;
  name: string;
}

interface ClickUpList {
  id: string;
  name: string;
}

interface ClickUpChecklistItem {
  id: string;
  name: string;
  resolved: boolean;
  orderindex: number;
}

interface ClickUpChecklist {
  id: string;
  name: string;
  items: ClickUpChecklistItem[];
}

interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value: number | string | boolean | null | undefined;
  type_config: {
    options?: Array<{ id: string; name: string; orderindex: number }>;
  };
}

interface ClickUpTask {
  id: string;
  name: string;
  description: string;
  text_content: string;
  status: { status: string };
  due_date: string | null;
  checklists: ClickUpChecklist[];
  custom_fields: ClickUpCustomField[];
}

async function clickupFetch(path: string, apiToken: string): Promise<unknown> {
  const res = await fetch(`${CLICKUP_API}${path}`, {
    headers: { Authorization: apiToken },
  });
  if (!res.ok) {
    throw new Error(`ClickUp API error ${res.status} for ${path}`);
  }
  return res.json();
}

// Resolves a dropdown field's numeric orderindex value to its label string
function resolveDropdown(field: ClickUpCustomField): string | null {
  if (field.value === null || field.value === undefined) return null;
  const options = field.type_config?.options ?? [];
  const match = options.find((o) => o.orderindex === Number(field.value));
  return match?.name ?? null;
}

function resolveCustomFields(customFields: ClickUpCustomField[]) {
  const byId: Record<string, ClickUpCustomField> = {};
  for (const cf of customFields) byId[cf.id] = cf;

  const get = (id: string) => byId[id];

  return {
    client: resolveDropdown(get(CUSTOM_FIELD_IDS.client)) ?? null,
    cadence: resolveDropdown(get(CUSTOM_FIELD_IDS.cadence)) ?? null,
    responsibility: resolveDropdown(get(CUSTOM_FIELD_IDS.responsibility)) ?? null,
    listType: resolveDropdown(get(CUSTOM_FIELD_IDS.listType)) ?? null,
    taskType: resolveDropdown(get(CUSTOM_FIELD_IDS.taskType)) ?? null,
    workMonth: resolveDropdown(get(CUSTOM_FIELD_IDS.workMonth)) ?? null,
    workYear: resolveDropdown(get(CUSTOM_FIELD_IDS.workYear)) ?? null,
    approvalRequired: get(CUSTOM_FIELD_IDS.approvalRequired)?.value === true,
  };
}

async function fetchAllTasksFromList(
  listId: string,
  apiToken: string
): Promise<ClickUpTask[]> {
  const allTasks: ClickUpTask[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const data = (await clickupFetch(
      `/list/${listId}/task?include_closed=true&page=${page}`,
      apiToken
    )) as { tasks: ClickUpTask[] };

    const tasks = data.tasks ?? [];
    allTasks.push(...tasks);

    // ClickUp returns up to 100 per page; if < 100 we've reached the end
    hasMore = tasks.length === 100;
    page++;
  }

  return allTasks;
}

export async function runSync(apiToken: string): Promise<void> {
  const db = getFirestore();

  console.log("Starting ClickUp sync...");

  // Step 1: Dynamically fetch all folders in Clients space
  const foldersData = (await clickupFetch(
    `/space/${CLIENTS_SPACE_ID}/folder?archived=false`,
    apiToken
  )) as { folders: ClickUpFolder[] };

  const clientFolders = foldersData.folders.filter(
    (f) => !f.name.startsWith(TEMPLATE_FOLDER_PREFIX)
  );

  console.log(`Found ${clientFolders.length} client folders`);

  for (const folder of clientFolders) {
    console.log(`Processing client: ${folder.name} (${folder.id})`);

    // Step 2: Find the Monthly Work - Recurring list in this folder
    const listsData = (await clickupFetch(
      `/folder/${folder.id}/list?archived=false`,
      apiToken
    )) as { lists: ClickUpList[] };

    const monthlyList = listsData.lists.find(
      (l) => l.name === MONTHLY_WORK_LIST_NAME
    );

    if (!monthlyList) {
      console.warn(`No "${MONTHLY_WORK_LIST_NAME}" list found in folder ${folder.name}, skipping`);
      continue;
    }

    // Step 3: Upsert client document — only sync fields, never touch admin fields
    const clientRef = db.collection("clients").doc(folder.id);
    await clientRef.set(
      {
        clickupFolderId: folder.id,
        clickupFolderName: folder.name,
        monthlyWorkListId: monthlyList.id,
        syncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true } // preserves admin-managed fields (fullName, coverImageUrl, etc.)
    );

    // Step 4: Fetch all tasks from ClickUp (paginated)
    const tasks = await fetchAllTasksFromList(monthlyList.id, apiToken);
    console.log(`  ${tasks.length} tasks fetched for ${folder.name}`);

    const clickupTaskIds = new Set(tasks.map((t) => t.id));
    const BATCH_SIZE = 400; // Firestore batch limit is 500 writes

    // Step 5: Delete tasks that no longer exist in ClickUp
    const existingSnap = await clientRef.collection("tasks").select().get();
    const toDelete = existingSnap.docs.filter((d) => !clickupTaskIds.has(d.id));

    if (toDelete.length > 0) {
      console.log(`  Deleting ${toDelete.length} removed tasks for ${folder.name}`);
      for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = db.batch();
        toDelete.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    // Step 6: Upsert all current tasks
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = tasks.slice(i, i + BATCH_SIZE);

      for (const task of chunk) {
        const taskRef = clientRef.collection("tasks").doc(task.id);
        const customFields = resolveCustomFields(task.custom_fields ?? []);

        const checklist = (task.checklists ?? []).flatMap((cl) =>
          (cl.items ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            resolved: item.resolved,
            orderIndex: item.orderindex,
          }))
        );

        batch.set(taskRef, {
          taskId: task.id,
          name: task.name,
          description: task.text_content ?? task.description ?? "",
          status: task.status?.status ?? null,
          dueDate: task.due_date
            ? Timestamp.fromMillis(Number(task.due_date))
            : null,
          checklist,
          ...customFields,
          syncedAt: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
    }

    console.log(`  Done: ${folder.name}`);
  }

  console.log("ClickUp sync complete.");
}
