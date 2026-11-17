const groupsList = document.querySelector('#groups-list');
const groupForm = document.querySelector('#group-form');

function createTextNode(label, value) {
  const wrapper = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = label;
  wrapper.appendChild(name);
  wrapper.appendChild(document.createTextNode(` ${value}`));
  return wrapper;
}

function renderGroups(groups) {
  if (!groupsList) return;

  while (groupsList.firstChild) {
    groupsList.removeChild(groupsList.firstChild);
  }

  if (!groups.length) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = 'No study groups yet. Create the first one above.';
    groupsList.appendChild(emptyItem);
    return;
  }

  groups.forEach((group) => {
    const item = document.createElement('li');
    const meta = document.createElement('div');
    meta.className = 'meta';

    const heading = document.createElement('h3');
    heading.textContent = group.name;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
      await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
      await loadGroups();
    });

    meta.appendChild(heading);
    meta.appendChild(deleteButton);

    const description = document.createElement('p');
    description.textContent = group.description || 'No description provided.';

    const created = document.createElement('small');
    created.textContent = new Date(group.created_at).toLocaleString();

    item.appendChild(meta);
    item.appendChild(description);
    item.appendChild(created);
    groupsList.appendChild(item);
  });
}

async function loadGroups() {
  const response = await fetch('/api/groups', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    return;
  }

  const groups = await response.json();
  renderGroups(groups);
}

if (groupForm) {
  groupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(groupForm);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      description: String(formData.get('description') || '').trim(),
    };

    if (!payload.name) {
      return;
    }

    await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    groupForm.reset();
    await loadGroups();
  });
}

loadGroups();
