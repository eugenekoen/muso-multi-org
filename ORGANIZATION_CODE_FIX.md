# Organization Code Validation Fix

## Problem
Users reported that organization codes sometimes show as "invalid" when joining a church, but work in a different browser. This is caused by:

1. **Browser autocorrect** - Mobile keyboards adding unwanted characters or spaces
2. **Autocomplete** - Browser suggestions changing the code format
3. **Whitespace** - Extra spaces before/after the code
4. **Case sensitivity** - Inconsistent case handling
5. **Special characters** - Different browsers handling special characters differently

## Solution

### 1. Frontend Changes

#### HTML Input Improvements ([index.html](index.html#L377-L379))
- Added `autocomplete="off"` - Prevents browser autocomplete suggestions
- Added `spellcheck="false"` - Disables spell checker
- Added `autocorrect="off"` - Prevents iOS autocorrect
- Added `autocapitalize="off"` - Prevents automatic capitalization
- Added code preview element displaying normalized code in real-time

#### JavaScript Normalization ([assets/js/organization.js](assets/js/organization.js#L391-L400))
Created `normalizeOrgCode()` function that:
- Removes all spaces
- Removes all special characters (keeping only alphanumeric)
- Converts to UPPERCASE
- Example: `"G CC-2024"` → `"GCC2024"`, `"gcc2024"` → `"GCC2024"`

#### Real-time User Feedback ([assets/js/init.js](assets/js/init.js#L849-L871))
- Shows normalized code as user types in the input field
- Displays green checkmark and normalized code
- Helps users understand what code is being validated

### 2. Backend Changes

#### Database Function ([supabase/normalize_org_codes.sql](supabase/normalize_org_codes.sql))
Updated the `get_org_by_code()` Postgres RPC function to:
- Normalize both the input code and stored signup_code in the database
- Use case-insensitive matching
- Handle special characters consistently
- Only return enabled organizations

## Implementation Steps

1. **Deploy frontend files:**
   - Update [assets/js/organization.js](assets/js/organization.js)
   - Update [assets/js/init.js](assets/js/init.js)
   - Update [index.html](index.html)

2. **Update database function:**
   - Open Supabase dashboard → SQL Editor
   - Execute the SQL from [supabase/normalize_org_codes.sql](supabase/normalize_org_codes.sql)

## Expected Behavior After Fix

### Before
- User enters: `G CC-2024` on iPhone
- System checks: `G CC-2024` (exact match fails)
- Result: ❌ Invalid code

### After
- User enters: `G CC-2024` on iPhone
- Input preview shows: ✓ Code: `GCC2024`
- System checks: `GCC2024` (normalized match succeeds)
- Result: ✅ Code accepted

## Testing Recommendations

1. **Test on multiple devices:**
   - Different browsers (Chrome, Safari, Firefox)
   - Different OS (iOS, Android, Windows, Mac)
   - Different keyboards (default, third-party)

2. **Test various code formats:**
   - `GCC2024`
   - `gcc2024`
   - `G-CC-2024`
   - `G CC 2024`
   - `GCC-2024`
   - `g cc 2024`

3. **Verify edge cases:**
   - Codes with numbers and letters mixed
   - Uppercase and lowercase variations
   - Codes with hyphens or spaces
   - Very short codes
   - Very long codes
