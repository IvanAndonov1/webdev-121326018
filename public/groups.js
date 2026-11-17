const status = document.getElementById('status');
const groupsContainer = document.getElementById('groups');
const logoutButton = document.getElementById('logout-button');

async function loadGroups() {
  status.textContent = 'Loading study groups…';
  groupsContainer.innerHTML = '';

  const response = await fetch('/api/groups', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (response.status === 401) {
    window.location.href = '/login';
    return;
  }

  const rows = await response.json();

  if (!response.ok) {
    status.textContent = rows.error || 'Unable to load study groups.';
    return;
  }

  if (rows.length === 0) {
    status.textContent = 'No study groups yet.';
    groupsContainer.innerHTML = '<div class="empty-state">Create the first study group for your course.</div>';
    return;
  }

  status.textContent = `${rows.length} group${rows.length === 1 ? '' : 's'} available.`;
  groupsContainer.innerHTML = rows
    .map(
      (group) => `
        <article class="group-card">
          <h2>${group.name}</h2>
          <p class="meta"><strong>Course:</strong> ${group.courseCode} · ${group.courseTitle}</p>
          <p class="meta"><strong>When:</strong> ${group.meetingDay} at ${group.meetingTime}</p>
          <p class="meta"><strong>Members:</strong> ${group.memberCount}/${group.maxMembers}</p>
          <p>${group.description}</p>
        </article>
      `
    )
    .join('');
}

logoutButton.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

loadGroups();
