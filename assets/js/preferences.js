/**
 * User Preferences Module
 * Handles theme switching and display name changes
 */

const THEME_KEY = 'muso-theme';

/**
 * Applies a theme class to the body element
 */
function applyTheme(theme)
{
    document.body.classList.remove('theme-dark', 'theme-midnight-blue');
    if (theme && theme !== 'light')
    {
        document.body.classList.add(`theme-${theme}`);
    }
    localStorage.setItem(THEME_KEY, theme || 'light');

    // Update the radio button in the modal
    const radio = document.querySelector(`input[name="theme"][value="${theme || 'light'}"]`);
    if (radio) radio.checked = true;
}

/**
 * Loads and applies the saved theme on startup
 */
function loadSavedTheme()
{
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(saved);
}

/**
 * Opens the preferences modal and populates current values
 */
async function openPreferencesModal()
{
    const modal = document.getElementById('user-preferences-modal');
    if (!modal) return;

    const nameInput = document.getElementById('pref-display-name');
    const currentName = window.authModule?.getCurrentUserName();
    if (nameInput && currentName)
    {
        nameInput.value = currentName;
    }

    // Set current theme radio
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    const radio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
    if (radio) radio.checked = true;

    modal.style.display = 'block';
}

/**
 * Saves the display name to the profiles table
 */
async function saveDisplayName()
{
    const supabaseClient = window.getSupabaseClient();
    const nameInput = document.getElementById('pref-display-name');
    const msgEl = document.getElementById('user-preferences-msg');
    const saveBtn = document.getElementById('save-display-name-btn');

    const newName = nameInput?.value.trim();
    if (!newName)
    {
        showPrefsMessage('Please enter a display name.', true);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try
    {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('Not logged in');

        const { error } = await supabaseClient
            .from('profiles')
            .update({ full_name: newName })
            .eq('id', user.id);

        if (error) throw error;

        showPrefsMessage('Display name updated successfully.');

        // Update the nav bar and internal state
        if (window.authModule)
        {
            window.authModule.setCurrentUserName(newName);
            window.authModule.updateNavUserInfo();
        }
    } catch (error)
    {
        console.error('Error updating display name:', error);
        showPrefsMessage(`Error: ${error.message}`, true);
    } finally
    {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Name';
    }
}

/**
 * Handles theme selection from the picker
 */
function handleThemeChange(theme)
{
    applyTheme(theme);
    showPrefsMessage(`Theme changed to ${theme === 'midnight-blue' ? 'Midnight' : theme.charAt(0).toUpperCase() + theme.slice(1)}.`);
}

function showPrefsMessage(message, isError = false)
{
    const msgEl = document.getElementById('user-preferences-msg');
    if (!msgEl) return;
    msgEl.textContent = message;
    msgEl.style.color = isError ? 'red' : 'green';
    setTimeout(() => { msgEl.textContent = ''; }, 3000);
}

// Apply saved theme as soon as body is available
if (document.body)
{
    loadSavedTheme();
} else
{
    document.addEventListener('DOMContentLoaded', loadSavedTheme);
}

// Export
window.preferencesModule = {
    openPreferencesModal,
    saveDisplayName,
    handleThemeChange,
    applyTheme,
    loadSavedTheme
};
