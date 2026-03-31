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

    orgTableBody.innerHTML = '<tr><td colspan="5">Loading organizations...</td></tr>';

    try
    {
        const { data: organizations, error } = await supabaseClient
            .from('organizations')
            .select('id, name, signup_code, is_disabled')
            .order('name', { ascending: true });

        if (error) throw error;

        orgTableBody.innerHTML = '';

        if (!organizations || organizations.length === 0)
        {
            orgTableBody.innerHTML = '<tr><td colspan="5">No organizations found.</td></tr>';
            return;
        }

        organizations.forEach(org =>
        {
            const row = orgTableBody.insertRow();
            const statusText = org.is_disabled ? 'Disabled' : 'Active';
            const statusColor = org.is_disabled ? '#f44336' : '#4CAF50';
            const toggleBtnText = org.is_disabled ? 'Enable' : 'Disable';
            const toggleBtnColor = org.is_disabled ? '#4CAF50' : '#f44336';

            row.innerHTML = `
                <td class="name-col">${org.name}</td>
                <td class="code-col">
                    <input type="text" class="org-code-input" data-org-id="${org.id}" value="${org.signup_code || ''}">
                </td>
                <td class="status-col">
                    <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
                </td>
                <td class="actions-col">
                    <div class="action-dropdown">
                        <button class="action-dropdown-btn" onclick="this.parentElement.classList.toggle('show')">
                            Actions <i class="fa-solid fa-chevron-down" style="font-size: 10px;"></i>
                        </button>
                        <div class="action-dropdown-content">
                            <button class="update-org-code-btn" data-org-id="${org.id}">
                                <i class="fa-solid fa-save"></i> Update Code
                            </button>
                            <button class="toggle-org-status-btn" data-org-id="${org.id}" style="color: ${toggleBtnColor};">
                                <i class="fa-solid fa-power-off"></i> ${toggleBtnText}
                            </button>
                            <button class="delete-org-btn text-danger" data-org-id="${org.id}">
                                <i class="fa-solid fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
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

async function toggleOrganizationDisableStatus(orgId)
{
    const supabaseClient = window.getSupabaseClient();

    try
    {
        // First, get the current status
        const { data: org, error: fetchError } = await supabaseClient
            .from('organizations')
            .select('is_disabled')
            .eq('id', orgId)
            .maybeSingle();

        if (fetchError) throw fetchError;

        const currentStatus = org?.is_disabled || false;
        const newStatus = !currentStatus;
        const action = newStatus ? 'disabled' : 'enabled';

        // Update the status
        const { error } = await supabaseClient
            .from('organizations')
            .update({ is_disabled: newStatus })
            .eq('id', orgId);

        if (error) throw error;
        showKeyManagerMessage(`Organization successfully ${action}.`);
        await populateKeyManagerModal();
    } catch (error)
    {
        console.error("Error toggling organization status:", error);
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
    toggleOrganizationDisableStatus,
    deleteOrganization,
    showKeyManagerMessage
};
