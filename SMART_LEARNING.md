# Smart Learning Feature - Auto-update Rules from User Activities

## Overview

The Smart Learning feature allows the extension to automatically learn from your tab organizing behavior and improve its grouping suggestions over time. The more you use it, the smarter it gets!

## How It Works

The extension observes your actions and builds confidence in patterns:

### 1. **Learning from Tab Moves**
When you manually move a tab from one group to another, the extension learns:
- The tab's domain should be in the new category
- Increases confidence for this pattern

**Example**: If you move `github.com` from "Other" to "Work", the extension learns to classify GitHub as Work.

### 2. **Learning from Group Renames**
When you rename a group, the extension learns:
- All tabs in the group should be associated with the new category name
- Increases confidence for each domain in the group

**Example**: If you rename a group containing `gmail.com` and `outlook.com` to "Email", it learns both are Email sites.

### 3. **Learning from Ungroups**
When you explicitly ungroup a tab (remove from any group):
- Decreases confidence in its current classification
- May remove the rule if confidence drops too low

This helps the extension "unlearn" incorrect patterns.

## Configuration

Access learning settings in **Options** → **Smart Learning Settings**:

### Enable/Disable Learning
- **Enable smart learning**: Master toggle for all learning features
- **Learn from moving tabs**: Learn when you move tabs between groups
- **Learn from renaming groups**: Learn when you rename groups
- **Learn from ungrouping tabs**: Learn when you remove tabs from groups

### Confidence Threshold
- **Minimum confidence level**: How many times to confirm before applying (1-10)
  - Lower = Faster learning, more mistakes
  - Higher = Slower learning, more accurate
  - Default: 2 (balance of speed and accuracy)

## Rule Priority

When classifying tabs, the extension uses this priority order:

1. **Learned Rules** (highest priority - based on your behavior)
2. **Custom Rules** (manually added in Settings)
3. **Default Rules** (built-in domain mappings)
4. **Keyword Detection** (from page titles)
5. **URL Patterns** (fallback)

## Viewing Learned Rules

In **Options** → **Smart Learning Settings**:

### Statistics Dashboard
- **Total Actions Learned**: Number of learning events
- **Tab Moves**: Times tabs were moved
- **Group Renames**: Times groups were renamed
- **Learned Rules**: Number of active learned rules

### Learned Rules List
Shows all learned patterns:
- Domain name
- Learned category
- Confidence level (how many times confirmed)
- Delete option (resets all learning)

## Example Learning Scenarios

### Scenario 1: Personal Work Organization
```
Initial state:
- github.com → Development (default)
- notion.so → Work (default)

Your actions:
1. Create a group called "Backend Dev"
2. Move github.com tab to it
3. Move stackoverflow.com tab to it

Result:
Extension learns:
- github.com → Backend Dev (confidence: 1)
- stackoverflow.com → Backend Dev (confidence: 1)
```

### Scenario 2: Email Group
```
Initial state:
- gmail.com → Communication (default)
- outlook.com → Communication (default)

Your actions:
1. Rename "Communication" group to "Personal Email"

Result:
Extension learns:
- gmail.com → Personal Email (confidence: 1)
- outlook.com → Personal Email (confidence: 1)
```

### Scenario 3: Correcting Mistakes
```
Initial state:
- youtube.com → Entertainment (default)

Your actions:
1. Move youtube.com to "Learning" (for tutorials)
2. Later move it back to "Entertainment" (was just watching)

Result:
Extension learns:
- First move: youtube.com → Learning (confidence: 1)
- Second move: youtube.com → Entertainment (confidence: 0 - unlearned)
```

## Privacy & Data

### What's Stored
- Domain → Category mappings
- Confidence scores
- Learning statistics
- Timestamps

### What's NOT Stored
- Specific URLs (only domain names)
- Tab titles or content
- Personal information
- Browsing history

### Data Location
All learning data is stored locally in your browser's extension storage (`chrome.storage.local`). Nothing is sent to external servers.

## Managing Learning Data

### Reset Individual Rules
Currently, individual rule deletion is not implemented. To remove specific rules:
1. Note the domains you want to reset
2. Click "Reset All Learning"
3. Re-organize tabs to relearn desired patterns

### Reset All Learning
In **Options** → **Smart Learning Settings**:
1. Scroll to "Learned Domain Rules"
2. Click "Reset All Learning"
3. Confirm the action

This removes all learned patterns but keeps:
- Custom rules (manually added)
- Default rules (built-in)
- Category colors
- Other settings

## Best Practices

### Do:
- ✅ Create meaningful group names that match your workflow
- ✅ Be consistent with category names
- ✅ Let confidence build up (2-3 confirmations)
- ✅ Regularly check learned rules in Settings
- ✅ Reset learning if it becomes inaccurate

### Don't:
- ❌ Frequently rename the same group to different names
- ❌ Move tabs randomly (creates conflicting patterns)
- ❌ Set confidence too low (1 = very noisy)
- ❌ Expect perfect learning immediately (takes time)

## Troubleshooting

### Learning Not Working
1. Check if "Enable smart learning" is on in Settings
2. Verify specific learning types are enabled
3. Check browser console for errors (F12 → Console)
4. Try reloading the extension

### Learned Rules Inaccurate
1. Increase "Minimum confidence level" to 3-5
2. Reset learning and start fresh
3. Be more consistent with your organizing
4. Use custom rules for sites that don't fit patterns

### Can't See Learned Rules
1. Open Options page
2. Scroll to "Smart Learning Settings"
3. Click "Refresh" button
4. Check if statistics show "0" (no learning data yet)

## Technical Details

### Storage Structure
```javascript
{
  learnedDomainRules: {
    'github.com': {
      category: 'Backend Dev',
      confidence: 3,
      lastSeen: 1234567890,
      sources: ['tab-move', 'group-rename']
    }
  },
  userPreferences: {
    learningEnabled: true,
    autoLearnFromMoves: true,
    autoLearnFromRenames: true,
    autoLearnFromUngroups: true,
    minConfidence: 2
  },
  learningStats: {
    totalActions: 15,
    movesLearned: 8,
    renamesLearned: 5,
    ungroupsLearned: 2,
    lastUpdate: 1234567890
  }
}
```

### Event Listeners
The learning engine listens to:
- `chrome.tabGroups.onUpdated` - Group renames, color changes
- `chrome.tabs.onMoved` - Tab movements between groups
- `chrome.tabs.onDetached` - Tabs being ungrouped

## Future Enhancements

Planned improvements:
- [ ] Individual rule deletion/editing
- [ ] Keyword learning from tab titles
- [ ] Export/import learned rules
- [ ] Learning suggestions (propose rules to add)
- [ ] Confidence decay (old patterns lose influence)
- [ ] Time-based learning (learn time-of-day patterns)
- [ ] Context-aware learning (project-specific groups)

## Feedback

If you find issues with the learning feature or have suggestions:
1. Check the browser console for errors
2. Try resetting learning data
3. Report issues with:
   - What action you took
   - What you expected to learn
   - What actually happened

Enjoy a smarter, personalized tab grouping experience! 🎓
