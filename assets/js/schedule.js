/**
 * Schedule Module
 * Handles worship team scheduling by quarter
 */
console.log("Schedule Module Loaded v1.2");

let currentYear = new Date().getFullYear();
let currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
let organizationMembers = [];
let customColumns = []; // [{name: 'Lighting', type: 'single'}]
let availableYears = [2024, 2025, 2026]; // Default fallback



/**
 * Get all Sundays for a specific quarter
 */
function getQuarterSundays(year, quarter)
{
    const quarters = {
        1: { start: 0, end: 2 },   // Jan-Mar
        2: { start: 3, end: 5 },   // Apr-Jun
        3: { start: 6, end: 8 },   // Jul-Sep
        4: { start: 9, end: 11 }   // Oct-Dec
    };

    const { start, end } = quarters[quarter];
    const sundays = [];

    for (let month = start; month <= end; month++)
    {
        const lastDay = new Date(year, month + 1, 0).getDate();

        for (let day = 1; day <= lastDay; day++)
        {
            const date = new Date(year, month, day);
            if (date.getDay() === 0)
            { // Sunday = 0
                sundays.push(date);
            }
        }
    }

    return sundays;
}

/**
 * Check if a quarter is in the past (read-only)
 */
function isQuarterPast(year, quarter)
{
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

    if (year < currentYear) return true;
    if (year === currentYear && quarter < currentQuarter) return true;
    return false;
}

/**
 * Format date as "15 February 2026"
 */
function formatDateDisplay(date)
{
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Format date as YYYY-MM-DD for database
 */
function formatDateDB(date)
{
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Load organization members for dropdowns
 */
async function loadOrganizationMembers(organizationId)
{
    const supabaseClient = window.getSupabaseClient();
    if (!supabaseClient || !organizationId) return;

    try
    {
        // Get member IDs
        const { data: members, error: memError } = await supabaseClient
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', organizationId);

        if (memError) throw memError;

        if (!members || members.length === 0)
        {
            organizationMembers = [];
            return;
        }

        const userIds = members.map(m => m.user_id);

        // Get user profiles (name + email)
        const { data: profiles, error: profileError } = await supabaseClient
            .from('profiles')
            .select('user_id:id, full_name')
            .in('id', userIds);

        if (profileError) throw profileError;

        organizationMembers = profiles || [];
        // Sort members alphabetically for professional feel
        organizationMembers.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

        console.log(`Loaded ${organizationMembers.length} members`);

    } catch (error)
    {
        console.error('Error loading members:', error);
        organizationMembers = [];
    }
}

/**
 * Load schedules for a specific quarter
 */
async function loadQuarterSchedules(organizationId, year, quarter)
{
    const supabaseClient = window.getSupabaseClient();
    if (!supabaseClient || !organizationId) return;

    // Load custom role definitions for the org
    try
    {
        const { data: org, error: orgError } = await supabaseClient
            .from('organizations')
            .select('custom_schedule_roles')
            .eq('id', organizationId)
            .maybeSingle();

        if (!orgError && org)
        {
            const rawRoles = org.custom_schedule_roles || [];
            // Normalize: convert old string roles to object format
            customColumns = rawRoles.map(r => typeof r === 'string' ? { name: r, type: 'single' } : r);

            // Load available years
            if (org.available_years && Array.isArray(org.available_years))
            {
                availableYears = org.available_years.sort((a, b) => a - b);
            }

            console.log("Loaded custom roles:", customColumns);
            console.log("Available years:", availableYears);

            // Ensure selector is populated
            renderYearSelector();
        }
    } catch (e)
    {
        console.warn("Could not load custom data from DB", e);

    }

    const sundays = getQuarterSundays(year, quarter);
    const dateStrings = sundays.map(formatDateDB);

    try
    {
        const { data, error } = await supabaseClient
            .from('service_schedules')
            .select('*')
            .eq('organization_id', organizationId)
            .in('service_date', dateStrings);

        if (error) throw error;

        return data || [];

    } catch (error)
    {
        console.error('Error loading schedules:', error);
        return [];
    }
}


/**
 * Save or update a schedule
 */
async function saveSchedule(scheduleData)
{
    const supabaseClient = window.getSupabaseClient();
    const organizationId = window.activeOrganizationId;

    if (!supabaseClient || !organizationId)
    {
        showToast('Error: No active organization', 'error');
        return;
    }

    try
    {
        const { error } = await supabaseClient
            .from('service_schedules')
            .upsert({
                organization_id: organizationId,
                service_date: scheduleData.date,
                leader_id: scheduleData.leader || null,
                bass_id: scheduleData.bass || null,
                keys_id: scheduleData.keys || null,
                piano_id: scheduleData.piano || null,
                drums_id: scheduleData.drums || null,
                sound_id: scheduleData.sound || null,
                av_id: scheduleData.av || null,
                guitar_ids: scheduleData.guitar || [],
                vocals_ids: scheduleData.vocals || [],
                custom_roles: scheduleData.custom || {}
            }, { onConflict: 'organization_id, service_date' });

        if (error) throw error;

        showToast('Schedule saved successfully!', 'success');

    } catch (error)
    {
        console.error('Error saving schedule:', error);
        showToast('Failed to save schedule', 'error');
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success')
{
    // Remove existing toast if any
    const existing = document.querySelector('.schedule-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `schedule-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() =>
    {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Render schedule cards for current quarter
 */
async function renderScheduleCards()
{
    const container = document.getElementById('schedule-cards-container');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading schedules...</div>';

    const organizationId = window.activeOrganizationId;
    if (!organizationId)
    {
        container.innerHTML = '<p>Please select a church first.</p>';
        return;
    }

    // Load members and schedules
    await loadOrganizationMembers(organizationId);
    const schedules = await loadQuarterSchedules(organizationId, currentYear, currentQuarter);

    const sundays = getQuarterSundays(currentYear, currentQuarter);
    const isPast = isQuarterPast(currentYear, currentQuarter);
    const currentUserRole = window.authModule ? window.authModule.getCurrentUserRole() : null;
    const isAdmin = !!(currentUserRole && String(currentUserRole).toLowerCase() === 'admin');
    const isReadOnly = isPast || !isAdmin;

    container.innerHTML = '';

    sundays.forEach(sunday =>
    {
        const dateStr = formatDateDB(sunday);
        const schedule = schedules.find(s => s.service_date === dateStr) || {};

        const card = createScheduleCard(sunday, schedule, isReadOnly);
        container.appendChild(card);
    });
}

/**
 * Role to Icon Mapping
 */
const ROLE_ICONS = {
    'leader': 'fa-brands fa-first-order',
    'bass': 'fa-solid fa-guitar',
    'keys': 'fa-solid fa-keyboard',
    'piano': 'fa-solid fa-music',
    'drums': 'fa-solid fa-drum',
    'sound': 'fa-solid fa-sliders',
    'av': 'fa-solid fa-desktop',
    'guitar': 'fa-solid fa-guitar',
    'vocals': 'fa-solid fa-microphone-lines',
    'default': 'fa-solid fa-user-plus'
};

/**
 * Get icon class for a role
 */
function getRoleIcon(role, isMulti = false)
{
    const key = String(role).toLowerCase();

    // For custom roles, use user/users icon based on single vs multi
    if (key.startsWith('custom_'))
    {
        return isMulti ? 'fa-solid fa-users' : 'fa-solid fa-user';
    }

    return ROLE_ICONS[key] || ROLE_ICONS['default'];
}

/**
 * Create a single schedule card
 */
function createScheduleCard(date, schedule, isReadOnly)
{
    const card = document.createElement('div');
    card.className = 'schedule-card';
    const dateStr = formatDateDB(date);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();

    card.dataset.date = dateStr;
    if (isReadOnly) card.classList.add('readonly');

    // Base/Standard Roles
    card.innerHTML = `
        <div class="schedule-date-badge">
            <span class="date-day">${day}</span>
            <span class="date-month">${month}</span>
            <span class="date-year">${year}</span>
        </div>
        <div class="schedule-content">
            <div class="schedule-roles">
                ${createRoleField('Leader', 'leader', schedule.leader_id, false, isReadOnly, true, false)}
                
                <!-- Organization Custom Roles (Persistent Columns) -->
                ${customColumns.map(col =>
    {
        const isMulti = col.type === 'multi';
        const value = schedule.custom_roles ? schedule.custom_roles[col.name] : (isMulti ? [] : null);
        return createRoleField(col.name, `custom_${col.name}`, value, isMulti, isReadOnly, false, true);
    }).join('')}
            </div>
        </div>
    `;

    // Add "Add Column" button if Admin
    const userRole = (window.authModule && window.authModule.getCurrentUserRole() || '').toLowerCase();
    const isAdmin = userRole === 'admin';
    if (!isReadOnly && isAdmin)
    {
        const addWrapper = document.createElement('div');
        addWrapper.className = 'add-role-wrapper';

        const addBtn = document.createElement('button');
        addBtn.className = 'add-column-btn';
        addBtn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> Add Global Role';
        addBtn.title = 'Add a role that will appear on all cards';
        addBtn.onclick = () => openAddGlobalRoleModal();

        addWrapper.appendChild(addBtn);
        card.querySelector('.schedule-roles').appendChild(addWrapper);
    }


    // Add auto-save listeners if not read-only
    if (!isReadOnly)
    {
        card.querySelectorAll('select').forEach(select =>
        {
            select.addEventListener('change', () =>
            {
                saveScheduleFromCard(dateStr, card);
            });
        });

        card.querySelectorAll('input[type="checkbox"]').forEach(checkbox =>
        {
            checkbox.addEventListener('change', () =>
            {
                saveScheduleFromCard(dateStr, card);
            });
        });
    }

    return card;
}


/**
 * Open the modal to add a new global role
 */
function openAddGlobalRoleModal()
{
    const modal = document.getElementById('add-global-role-modal');
    if (!modal) return;

    document.getElementById('new-global-role-name').value = '';
    document.getElementById('new-global-role-type').value = 'single';
    modal.style.display = 'block';
}

/**
 * Save the new global role
 */
async function saveGlobalRole()
{
    const nameInput = document.getElementById('new-global-role-name');
    const typeSelect = document.getElementById('new-global-role-type');
    const roleName = nameInput.value.trim();
    const roleType = typeSelect.value;

    if (!roleName)
    {
        alert("Please enter a role name.");
        return;
    }

    if (customColumns.some(c => c.name === roleName))
    {
        alert("This role already exists.");
        return;
    }

    const supabaseClient = window.getSupabaseClient();
    const organizationId = window.activeOrganizationId;

    if (!supabaseClient)
    {
        alert("Database connection not ready.");
        return;
    }
    if (!organizationId)
    {
        alert("No active organization found. Please close and re-select your church.");
        return;
    }


    try
    {
        const saveBtn = document.getElementById('save-global-role-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const newRole = { name: roleName, type: roleType };
        // Ensure we don't have duplicates and preserve object structure
        const updatedColumns = [...customColumns, newRole];

        console.log("Attempting to save global roles:", updatedColumns, "for org:", organizationId);

        const { data, error, count } = await supabaseClient
            .from('organizations')
            .update({ custom_schedule_roles: updatedColumns })
            .eq('id', organizationId)
            .select();


        if (error)
        {
            console.error("Supabase update error:", error);
            throw error;
        }

        console.log("Update response data:", data);

        if (!data || data.length === 0)
        {
            console.warn("Update succeeded but 0 rows were changed. This usually means your account doesn't have Permission (RLS) to update the Organizations table.");
            throw new Error("Permission denied: You do not have permission to update organization settings.");
        }

        customColumns = updatedColumns;

        document.getElementById('add-global-role-modal').style.display = 'none';
        showToast(`Role "${roleName}" added successfully!`, 'success');

        // Re-render
        renderScheduleCards();
    } catch (error)
    {
        console.error('Error saving global role:', error);
        showToast('Failed to save global role: ' + (error.message || 'Unknown error'), 'error');
    } finally
    {
        const saveBtn = document.getElementById('save-global-role-btn');
        if (saveBtn)
        {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Role';
        }
    }
}

/**
 * Delete a custom global role
 */
async function deleteCustomRoleGlobal(roleName)
{
    if (!confirm(`Are you sure you want to delete the "${roleName}" role from ALL schedules? This cannot be undone.`)) return;

    const supabaseClient = window.getSupabaseClient();
    const organizationId = window.activeOrganizationId;
    if (!supabaseClient || !organizationId) return;

    try
    {
        const updatedColumns = customColumns.filter(c => c.name !== roleName);

        const { error } = await supabaseClient
            .from('organizations')
            .update({ custom_schedule_roles: updatedColumns })
            .eq('id', organizationId);

        if (error) throw error;

        customColumns = updatedColumns;
        showToast(`Role "${roleName}" deleted.`, 'success');
        renderScheduleCards();
    } catch (e)
    {
        console.error("Error deleting role:", e);
        showToast("Failed to delete role", "error");
    }
}

/**
 * Create a role assignment field (single or multi)
 */
function createRoleField(label, role, value, isMulti, isReadOnly, isPriority = false, isCustom = false)
{
    const priorityClass = isPriority ? 'priority' : '';
    const userRole = (window.authModule && window.authModule.getCurrentUserRole() || '').toLowerCase();
    const isAdmin = userRole === 'admin';

    // Trash can for custom roles (Admins only)
    let deleteBtn = '';
    if (isCustom && isAdmin && !isReadOnly)
    {
        deleteBtn = `<i class="fa-solid fa-trash-can delete-role-btn" title="Delete this global role" onclick="window.scheduleModule.deleteCustomRoleGlobal('${label}')"></i>`;
    }

    if (isMulti)
    {
        return createMultiRoleField(label, role, value || [], isReadOnly, priorityClass, deleteBtn, isMulti);
    } else
    {
        return createSingleRoleField(label, role, value, isReadOnly, priorityClass, deleteBtn, isMulti);
    }
}

/**
 * Create single-person role dropdown
 */
function createSingleRoleField(label, role, selectedId, isReadOnly, priorityClass = '', deleteBtn = '', isMulti = false)
{
    const iconClass = getRoleIcon(role, isMulti);

    if (isReadOnly)
    {
        const member = organizationMembers.find(m => m.user_id === selectedId);
        const displayName = member ? member.full_name : 'Not Assigned';
        return `
            <div class="role-item single ${priorityClass}">
                <label><i class="${iconClass}"></i> ${label}</label>
                <div class="readonly-value">${displayName}</div>
            </div>
        `;
    }

    let options = '<option value="">Not Assigned</option>';
    organizationMembers.forEach(member =>
    {
        const selected = member.user_id === selectedId ? 'selected' : '';
        options += `<option value="${member.user_id}" ${selected}>${member.full_name}</option>`;
    });

    return `
        <div class="role-item single ${priorityClass}">
            <label>
                <span><i class="${iconClass}"></i> ${label}</span>
                ${deleteBtn}
            </label>
            <select class="role-select" data-role="${role}">
                ${options}
            </select>
        </div>
    `;
}


/**
 * Create multi-person role field with checkboxes
 */
function createMultiRoleField(label, role, selectedIds, isReadOnly, priorityClass = '', deleteBtn = '', isMulti = false)
{
    // Safety check: ensure selectedIds is always an array
    if (!Array.isArray(selectedIds)) selectedIds = [];

    const iconClass = getRoleIcon(role, isMulti);

    if (isReadOnly)
    {
        const members = organizationMembers.filter(m => selectedIds.includes(m.user_id));
        const displayNames = members.length > 0
            ? members.map(m => m.full_name).join(', ')
            : 'Not Assigned';
        return `
            <div class="role-item multi ${priorityClass}">
                <label><i class="${iconClass}"></i> ${label}</label>
                <div class="readonly-value">${displayNames}</div>
            </div>
        `;
    }

    let checkboxes = '';
    organizationMembers.forEach(member =>
    {
        const checked = selectedIds.includes(member.user_id) ? 'checked' : '';
        checkboxes += `
            <label class="checkbox-label">
                <input type="checkbox" value="${member.user_id}" ${checked} data-role="${role}">
                ${member.full_name}
            </label>
        `;
    });

    return `
        <div class="role-item multi ${priorityClass}">
            <label>
                <span><i class="${iconClass}"></i> ${label}</span>
                ${deleteBtn}
            </label>
            <div class="multi-select-container">
                ${checkboxes}
            </div>
        </div>
    `;
}



/**
 * Extract schedule data from card and save
 */
async function saveScheduleFromCard(dateStr, card)
{
    const scheduleData = { date: dateStr };

    // Single roles
    ['leader', 'bass', 'keys', 'piano', 'drums', 'sound', 'av'].forEach(role =>
    {
        const select = card.querySelector(`select[data-role="${role}"]`);
        if (select)
        {
            scheduleData[role] = select.value || null;
        }
    });

    // Multi roles (guitar, vocals)
    ['guitar', 'vocals'].forEach(role =>
    {
        const checkboxes = card.querySelectorAll(`input[data-role="${role}"]:checked`);
        scheduleData[role] = Array.from(checkboxes).map(cb => cb.value);
    });

    // Custom roles
    scheduleData.custom = {};
    customColumns.forEach(col =>
    {
        const roleKey = `custom_${col.name}`;
        if (col.type === 'multi')
        {
            const checkboxes = card.querySelectorAll(`input[data-role="${roleKey}"]:checked`);
            scheduleData.custom[col.name] = Array.from(checkboxes).map(cb => cb.value);
        } else
        {
            const select = card.querySelector(`select[data-role="${roleKey}"]`);
            if (select)
            {
                scheduleData.custom[col.name] = select.value || null;
            }
        }
    });

    await saveSchedule(scheduleData);
}


/**
 * Open Schedule Manager modal
 */
async function openScheduleManager()
{
    const modal = document.getElementById('schedule-manager-modal');
    if (!modal) return;

    const now = new Date();
    // Calculate the next (or current) Sunday
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7);

    // Set view to the target Sunday's year and quarter (handles quarter boundaries)
    currentYear = nextSunday.getFullYear();
    currentQuarter = Math.floor(nextSunday.getMonth() / 3) + 1;

    modal.style.display = 'block';

    // Sync year selector
    renderYearSelector();

    updateQuarterTabs();
    await renderScheduleCards();

    // --- AUTO-NAVIGATION TO CURRENT WEEK ---
    const targetDateStr = formatDateDB(nextSunday);

    // Wait for DOM to render the cards
    setTimeout(() =>
    {
        const targetCard = document.querySelector(`.schedule-card[data-date="${targetDateStr}"]`);
        if (targetCard)
        {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Subtle highlight to show user where they are
            targetCard.style.transition = "box-shadow 0.3s ease, border 0.3s ease";
            targetCard.style.boxShadow = "0 0 15px rgba(76, 175, 80, 0.4)";
            targetCard.style.border = "2px solid #4CAF50";

            setTimeout(() =>
            {
                targetCard.style.boxShadow = "";
                targetCard.style.border = "";
            }, 3000);
        }
    }, 150);
}

/**
 * Render the year selector dropdown
 */
function renderYearSelector()
{
    const selector = document.getElementById('schedule-year-select');
    if (!selector) return;

    let html = '';
    availableYears.forEach(year =>
    {
        const selected = year === currentYear ? 'selected' : '';
        html += `<option value="${year}" ${selected}>${year}</option>`;
    });

    // Add "Add Year" option if admin
    const userRole = (window.authModule && window.authModule.getCurrentUserRole() || '').toLowerCase();
    if (userRole === 'admin')
    {
        html += `<option value="ADD_NEW_YEAR">+ Add Year</option>`;
    }

    selector.innerHTML = html;
}

/**
 * Update quarter tab active states
 */
function updateQuarterTabs()
{
    document.querySelectorAll('.quarter-tab').forEach(tab =>
    {
        const quarter = parseInt(tab.dataset.quarter);
        // Update label to include year for context
        tab.textContent = `Q${quarter} ${currentYear}`;

        if (quarter === currentQuarter)
        {
            tab.classList.add('active');
        } else
        {
            tab.classList.remove('active');
        }
    });
}


/**
 * Switch to a different year
 */
async function switchYear(year)
{
    if (year === 'ADD_NEW_YEAR')
    {
        await addNewYear();
        return;
    }

    currentYear = parseInt(year);
    updateQuarterTabs();
    renderScheduleCards();
}

/**
 * Add a new future year
 */
async function addNewYear()
{
    const lastYear = availableYears[availableYears.length - 1] || new Date().getFullYear();
    const nextYear = lastYear + 1;

    if (!confirm(`Would you like to add ${nextYear} to the schedule manager?`))
    {
        // Reset selector to current year
        renderYearSelector();
        return;
    }

    const supabaseClient = window.getSupabaseClient();
    const organizationId = window.activeOrganizationId;
    if (!supabaseClient || !organizationId) return;

    try
    {
        const updatedYears = [...new Set([...availableYears, nextYear])].sort((a, b) => a - b);

        const { data, error } = await supabaseClient
            .from('organizations')
            .update({ available_years: updatedYears })
            .eq('id', organizationId)
            .select();

        if (error) throw error;

        if (!data || data.length === 0)
        {
            console.warn("Update succeeded but 0 rows were changed. This usually means your account doesn't have Permission (RLS) to update the Organizations table.");
            throw new Error("Permission denied: You do not have permission to update organization settings.");
        }

        availableYears = updatedYears;
        currentYear = nextYear;

        showToast(`Year ${nextYear} added!`, 'success');

        renderYearSelector();
        updateQuarterTabs();
        renderScheduleCards();
    } catch (e)
    {
        console.error("Error adding year:", e);
        showToast("Failed to add year", "error");
        renderYearSelector();
    }
}



/**
 * Switch to a different quarter
 */
function switchQuarter(quarter)
{
    currentQuarter = quarter;
    updateQuarterTabs();
    renderScheduleCards();
}

// Export module
window.scheduleModule = {
    openScheduleManager,
    switchQuarter,
    switchYear,
    openAddGlobalRoleModal,
    saveGlobalRole,
    deleteCustomRoleGlobal
};



// Global Event Listeners for the modal (static parts)
document.addEventListener('DOMContentLoaded', () =>
{
    document.querySelector('.close-global-role-modal-btn')?.addEventListener('click', () =>
    {
        document.getElementById('add-global-role-modal').style.display = 'none';
    });
});
