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

    // Set current song theme radio
    const savedSongTheme = localStorage.getItem('muso-song-theme') || 'auto';
    const songRadio = document.querySelector(`input[name="song-theme"][value="${savedSongTheme}"]`);
    if (songRadio) songRadio.checked = true;

    // Load and populate calendar feed token & URLs
    await loadUserCalendarToken();

    modal.style.display = 'block';
}

/**
 * Loads or generates the user's calendar token from profiles table
 */
async function loadUserCalendarToken()
{
    const supabaseClient = window.getSupabaseClient();
    const feedInput = document.getElementById('pref-calendar-feed-url');

    if (!supabaseClient || !feedInput) return;

    try
    {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        let { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('calendar_token')
            .eq('id', user.id)
            .maybeSingle();

        if (error) throw error;

        let token = profile?.calendar_token;

        // If user profile does not have a calendar_token yet, generate and save one
        if (!token)
        {
            token = crypto.randomUUID();
            await supabaseClient
                .from('profiles')
                .update({ calendar_token: token })
                .eq('id', user.id);
        }

        updateCalendarFeedElements(token);

    } catch (err)
    {
        console.error('Error loading calendar token:', err);
    }
}

/**
 * Updates DOM input elements with calendar token
 */
function updateCalendarFeedElements(token)
{
    const feedInput = document.getElementById('pref-calendar-feed-url');
    const supabaseUrl = 'https://xikllcuwvyuqcvcjjimw.supabase.co';
    const httpsFeedUrl = `${supabaseUrl}/functions/v1/ical-feed?token=${token}`;

    if (feedInput) feedInput.value = httpsFeedUrl;
}

/**
 * Triggers subscription to the calendar selected in the dropdown.
 * Uses window.location.href for guaranteed mobile compatibility —
 * this cannot be blocked by any popup blocker on any mobile browser.
 */
function subscribeSelectedCalendar()
{
    const select = document.getElementById('calendar-provider-select');
    const feedInput = document.getElementById('pref-calendar-feed-url');
    if (!feedInput || !feedInput.value) return;

    const httpsFeedUrl = feedInput.value;
    const webcalFeedUrl = httpsFeedUrl.replace(/^https:\/\//i, 'webcal://');
    const provider = select ? select.value : 'gcal';

    if (provider === 'gcal')
    {
        window.location.href = 'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(webcalFeedUrl);
    } else
    {
        window.location.href = webcalFeedUrl;
    }
}

/**
 * Copies the calendar feed URL to clipboard and highlights text
 */
async function copyCalendarFeedUrl()
{
    const feedInput = document.getElementById('pref-calendar-feed-url');
    if (!feedInput || !feedInput.value) return;

    try
    {
        feedInput.select();
        await navigator.clipboard.writeText(feedInput.value);
        showPrefsMessage('Calendar feed link copied to clipboard!');
    } catch (e)
    {
        feedInput.select();
        document.execCommand('copy');
        showPrefsMessage('Calendar feed link copied to clipboard!');
    }
}

/**
 * Resets the user's calendar token and updates feed links
 */
async function resetCalendarToken()
{
    const supabaseClient = window.getSupabaseClient();
    if (!supabaseClient) return;

    if (!confirm('Are you sure you want to reset your calendar token? Any calendar apps currently subscribed will lose access until updated.'))
    {
        return;
    }

    try
    {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('Not logged in');

        const newToken = crypto.randomUUID();
        const { error } = await supabaseClient
            .from('profiles')
            .update({ calendar_token: newToken })
            .eq('id', user.id);

        if (error) throw error;

        updateCalendarFeedElements(newToken);
        showPrefsMessage('Calendar token reset successfully! Please update your calendar subscriptions.');

    } catch (err)
    {
        console.error('Error resetting calendar token:', err);
        showPrefsMessage(`Error resetting token: ${err.message}`, true);
    }
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

/**
 * Handles song theme selection from the picker
 */
function handleSongThemeChange(theme)
{
    localStorage.setItem('muso-song-theme', theme || 'auto');
    showPrefsMessage(`Song view theme changed to ${theme === 'midnight-blue' ? 'Midnight' : theme === 'auto' ? 'Match App Theme' : theme.charAt(0).toUpperCase() + theme.slice(1)}.`);
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
    handleSongThemeChange,
    applyTheme,
    loadSavedTheme,
    loadUserCalendarToken,
    copyCalendarFeedUrl,
    resetCalendarToken,
    subscribeSelectedCalendar
};

