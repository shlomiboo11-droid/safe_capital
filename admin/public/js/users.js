/**
 * User management page logic (super_admin only)
 */

(function() {
  if (!requireAuth()) return;
  if (!hasRole('super_admin')) {
    window.location.href = '/';
    return;
  }

  const user = API.getUser();
  document.getElementById('sidebar-username').textContent = user.full_name;
  document.getElementById('sidebar-role').textContent = 'מנהל ראשי';

  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (toggle) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  loadUsers();
})();

const ROLE_LABELS = {
  super_admin: 'מנהל ראשי',
  manager: 'מנהל/שותף',
  investor: 'משקיע'
};

async function loadUsers() {
  try {
    const data = await API.get('/users');
    renderUsers(data.users);
  } catch (err) {
    document.getElementById('usersTable').innerHTML =
      `<tr><td colspan="6" class="text-center py-8 text-red-500">שגיאה: ${err.message}</td></tr>`;
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTable');

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">אין משתמשים</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td class="font-medium">${u.full_name}</td>
      <td class="font-inter text-sm text-gray-500" dir="ltr">${u.email}</td>
      <td><span class="badge ${u.role === 'super_admin' ? 'badge-blue' : u.role === 'manager' ? 'badge-yellow' : 'badge-gray'}">${ROLE_LABELS[u.role] || u.role}</span></td>
      <td><span class="badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}">${u.status === 'active' ? 'פעיל' : 'מושעה'}</span></td>
      <td class="text-sm text-gray-500">${formatDate(u.joined_at)}</td>
      <td>
        ${u.role !== 'super_admin' ? `
          <div class="flex gap-2">
            <button onclick="editUser(${u.id}, '${u.full_name}', '${u.email}', '${u.role}', '${u.phone || ''}')" class="btn btn-secondary btn-sm" title="ערוך">
              <span class="material-symbols-outlined text-sm">edit</span>
            </button>
            <button onclick="showResetPw(${u.id}, '${u.full_name}')" class="btn btn-secondary btn-sm" title="אפס סיסמה">
              <span class="material-symbols-outlined text-sm">lock_reset</span>
            </button>
            <button onclick="toggleUserStatus(${u.id}, '${u.status}')" class="btn btn-secondary btn-sm" title="${u.status === 'active' ? 'השעה' : 'הפעל'}">
              <span class="material-symbols-outlined text-sm">${u.status === 'active' ? 'block' : 'check_circle'}</span>
            </button>
            <button onclick="deleteUser(${u.id}, '${u.full_name}')" class="btn btn-danger btn-sm" title="מחק">
              <span class="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        ` : '<span class="text-xs text-gray-400">--</span>'}
      </td>
    </tr>
  `).join('');
}

function showAddUserModal() {
  document.getElementById('userModalTitle').textContent = 'משתמש חדש';
  document.getElementById('userSubmitBtn').textContent = 'צור משתמש';
  document.getElementById('userId').value = '';
  document.getElementById('passwordField').style.display = '';
  document.getElementById('userPassword').required = true;
  document.getElementById('userForm').reset();
  document.getElementById('userModal').classList.remove('hidden');
}

function editUser(id, name, email, role, phone) {
  document.getElementById('userModalTitle').textContent = 'עריכת משתמש';
  document.getElementById('userSubmitBtn').textContent = 'שמור שינויים';
  document.getElementById('userId').value = id;
  document.getElementById('userFullName').value = name;
  document.getElementById('userEmail').value = email;
  document.getElementById('userRole').value = role;
  document.getElementById('userPhone').value = phone;
  document.getElementById('passwordField').style.display = 'none';
  document.getElementById('userPassword').required = false;
  document.getElementById('userModal').classList.remove('hidden');
}

function closeUserModal() {
  document.getElementById('userModal').classList.add('hidden');
}

document.getElementById('userForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('userId').value;
  const body = {
    full_name: document.getElementById('userFullName').value.trim(),
    email: document.getElementById('userEmail').value.trim(),
    role: document.getElementById('userRole').value,
    phone: document.getElementById('userPhone').value.trim()
  };

  try {
    if (id) {
      await API.put(`/users/${id}`, body);
      showToast('המשתמש עודכן בהצלחה');
    } else {
      body.password = document.getElementById('userPassword').value;
      await API.post('/users', body);
      showToast('המשתמש נוצר בהצלחה');
    }
    closeUserModal();
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function toggleUserStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  const label = newStatus === 'active' ? 'להפעיל' : 'להשעות';
  if (!await confirmAction(`האם ${label} את המשתמש?`)) return;

  try {
    await API.put(`/users/${id}`, { status: newStatus });
    showToast('הסטטוס עודכן');
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUser(id, name) {
  if (!await confirmAction(`האם למחוק את המשתמש "${name}"? פעולה זו אינה ניתנת לביטול.`)) return;
  try {
    await API.delete(`/users/${id}`);
    showToast('המשתמש נמחק');
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showResetPw(id, name) {
  document.getElementById('resetPwUserId').value = id;
  document.getElementById('resetPwUserName').textContent = `איפוס סיסמה עבור: ${name}`;
  document.getElementById('resetPwValue').value = '';
  document.getElementById('resetPwModal').classList.remove('hidden');
}

document.getElementById('resetPwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('resetPwUserId').value;
  const newPw = document.getElementById('resetPwValue').value;

  try {
    await API.post(`/users/${id}/reset-password`, { new_password: newPw });
    showToast('הסיסמה אופסה בהצלחה');
    document.getElementById('resetPwModal').classList.add('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
});
