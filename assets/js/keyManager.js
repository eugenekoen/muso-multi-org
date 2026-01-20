/**
 * Key Manager Module
 * Handles organization management for the Master Admin
 */

async function populateKeyManagerModal()
{
    const supabaseClient = window.getSupabaseClient();
    const orgTableBody = document.querySelector('#org-management-table tbody');
    const msgEl = document.getElementById('key-manager-msg');

    if (!orgTableBody) return;

    orgTableBody.innerHTML = '<tr><td colspan="3">Loading organizations...</td></tr>';

    try
    {
        const { data: organizations, error } = await supabaseClient
            .from('organizations')
            .select('id, name, signup_code')
            .order('name', { ascending: true });

        if (error) throw error;

        orgTableBody.innerHTML = '';

        if (!organizations || organizations.length === 0)
        {
            orgTableBody.innerHTML = '<tr><td colspan="3">No organizations found.</td></tr>';
            return;
        }

        organizations.forEach(org =>
        {
            const row = orgTableBody.insertRow();
            row.innerHTML = `
                <td>${org.name}</td>
                <td>
                    <input type="text" class="org-code-input" data-org-id="${org.id}" value="${org.signup_code || ''}" style="width: 100%;">
                </td>
                <td style="white-space: nowrap;">
                    <button class="modal-btn update-org-code-btn" data-org-id="${org.id}">Update Code</button>
                    <button class="modal-btn delete-org-btn" data-org-id="${org.id}" style="background-color: #f44336; margin-left: 5px;">Delete</button>
                </td>
            `;
        });

    } catch (error)
    {
        console.error("Error fetching organizations:", error);
        orgTableBody.innerHTML = `<tr><td colspan="3" style="color: red;">Error: ${error.message}</td></tr>`;
    }
}

async function saveNewOrganization()
{
    const supabaseClient = window.getSupabaseClient();
    const nameInput = document.getElementById('new-org-name');
    const codeInput = document.getElementById('new-org-code');
    const msgEl = document.getElementById('key-manager-msg');
    const saveBtn = document.getElementById('save-new-org-btn');

    const name = nameInput.value.trim();
    const code = codeInput.value.trim();

    if (!name || !code)
    {
        showKeyManagerMessage("Church Name and Signup Code are required.", true);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Adding...';

    try
    {
        const { error } = await supabaseClient
            .from('organizations')
            .insert({ name, signup_code: code });

        if (error) throw error;

        showKeyManagerMessage("Successfully added organization.");
        nameInput.value = '';
        codeInput.value = '';
        await populateKeyManagerModal();

    } catch (error)
    {
        console.error("Error adding organization:", error);
        showKeyManagerMessage(`Error: ${error.message}`, true);
    } finally
    {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Add Church';
    }
}

async function updateOrganizationCode(orgId, newCode)
{
    const supabaseClient = window.getSupabaseClient();

    try
    {
        const { error } = await supabaseClient
            .from('organizations')
            .update({ signup_code: newCode })
            .eq('id', orgId);

        if (error) throw error;
        showKeyManagerMessage("Successfully updated signup code.");
    } catch (error)
    {
        console.error("Error updating organization code:", error);
        showKeyManagerMessage(`Error: ${error.message}`, true);
    }
}

async function deleteOrganization(orgId)
{
    const supabaseClient = window.getSupabaseClient();

    if (!confirm("Are you sure you want to PERMANENTLY delete this organization? This will NOT remove the songs or members automatically (unless cascading is set), but the church itself will be gone."))
    {
        return;
    }

    try
    {
        const { error } = await supabaseClient
            .from('organizations')
            .delete()
            .eq('id', orgId);

        if (error) throw error;
        showKeyManagerMessage("Successfully deleted organization.");
        await populateKeyManagerModal();
    } catch (error)
    {
        console.error("Error deleting organization:", error);
        showKeyManagerMessage(`Error: ${error.message}`, true);
    }
}

function showKeyManagerMessage(message, isError = false)
{
    const msgEl = document.getElementById('key-manager-msg');
    if (!msgEl) return;
    msgEl.textContent = message;
    msgEl.style.color = isError ? 'red' : 'green';
    setTimeout(() => { msgEl.textContent = ''; }, 4000);
}

// Export functions
window.keyManagerModule = {
    populateKeyManagerModal,
    saveNewOrganization,
    updateOrganizationCode,
    deleteOrganization,
    showKeyManagerMessage
};
