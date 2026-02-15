# Contributing to Brummies Rock Radio

First off, thank you for considering contributing to Brummies Rock Radio! 🎉

## 🌟 How Can I Contribute?

### Reporting Bugs 🐛

Before creating bug reports, please check the [existing issues](https://github.com/yourusername/brummies-rock-radio/issues) to avoid duplicates.

**When reporting a bug, include:**
- Clear, descriptive title
- Steps to reproduce the issue
- Expected vs. actual behavior
- Screenshots (if applicable)
- Browser/device information
- Console errors (F12 → Console)

**Example:**
```
Title: Player stops when switching tabs on iOS Safari

Steps:
1. Open app in iOS Safari
2. Play a station
3. Switch to another tab
4. Return to the app

Expected: Music continues playing
Actual: Player stops and needs to be restarted

Device: iPhone 13, iOS 16.4
Browser: Safari 16.4
```

### Suggesting Features 💡

We love feature suggestions! Before creating a feature request:
- Check if it's already been suggested
- Consider if it fits the app's philosophy ("think globally, listen locally")

**When suggesting a feature, include:**
- Clear description of the feature
- Why you think it would be useful
- How it should work (user flow)
- Any mockups or examples (optional)

**Example:**
```
Feature: Podcast Support

Description: Add ability to search and play podcasts alongside radio stations

Why: Many podcast platforms exist, but none integrate with local radio discovery

How: Add "Podcast" genre option, integrate podcast RSS feeds, maintain same UI/UX

Mockup: [link to sketch/image]
```

### Submitting Pull Requests 🚀

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/brummies-rock-radio.git
   cd brummies-rock-radio
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

3. **Make Your Changes**
   - Write clean, readable code
   - Follow the existing code style
   - Comment complex logic
   - Test thoroughly on multiple browsers

4. **Commit Your Changes**
   ```bash
   git commit -m "Add: Feature description"
   # or
   git commit -m "Fix: Bug description"
   ```

   **Commit Message Guidelines:**
   - Use present tense ("Add feature" not "Added feature")
   - Use imperative mood ("Move cursor to..." not "Moves cursor to...")
   - Prefix with type: `Add:`, `Fix:`, `Update:`, `Remove:`, `Refactor:`

5. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template
   - Link any related issues

**PR Checklist:**
- [ ] Code follows the project's style
- [ ] Tested on Chrome, Firefox, Safari
- [ ] Tested on mobile (iOS/Android)
- [ ] No console errors
- [ ] Updated documentation if needed
- [ ] Added comments for complex code

---

## 🎨 Code Style Guidelines

### JavaScript
```javascript
// Use const/let, not var
const stations = [];
let currentStation = null;

// Descriptive variable names
const userLocationLat = 51.1657;
const stationDistanceKm = 12.5;

// Functions: verb + noun
function calculateDistance(lat1, lon1, lat2, lon2) { ... }
function sortByDistance() { ... }

// Comments for complex logic
// Calculate distance using Haversine formula
// This accounts for Earth's curvature
const distance = ...;
```

### CSS
```css
/* Use kebab-case for classes */
.station-list { }
.data-usage-display { }

/* Mobile-first approach */
.container {
  /* Mobile styles */
}

@media (min-width: 768px) {
  .container {
    /* Desktop styles */
  }
}

/* Descriptive colors */
--color-primary: #ef4444;
--color-background: #0b0b0f;
```

### HTML
```html
<!-- Semantic HTML -->
<section class="station-search">
  <h2>Search Stations</h2>
  ...
</section>

<!-- Accessible attributes -->
<button id="playBtn" aria-label="Play station">▶</button>
```

---

## 🧪 Testing

Before submitting a PR, test on:

### Browsers
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

### Devices
- ✅ Desktop (Windows, Mac, Linux)
- ✅ Mobile (iOS Safari, Android Chrome)
- ✅ Tablet (iPad, Android tablet)

### Test Cases
1. **Basic Functionality**
   - Search for stations
   - Play/pause
   - Switch stations
   - Favorite stations

2. **Location Features**
   - GPS permission prompt
   - Distance calculation
   - Manual location selection
   - Sorting by distance

3. **Settings Panel**
   - Open/close panel
   - Data usage display
   - Theme switching (when implemented)

4. **Responsive Design**
   - Layout at different screen sizes
   - Touch targets (min 44px)
   - No horizontal scroll

5. **Performance**
   - Load time < 3 seconds
   - Smooth animations (60fps)
   - No memory leaks

---

## 🌍 Translation Guidelines

Want to help translate the app?

1. **Check Available Languages**
   - Currently supported: German (de)
   - Planned: English (en), Spanish (es), French (fr)

2. **Translation Files**
   - Will be located in `/i18n/` directory
   - Format: JSON with key-value pairs

3. **Translation Tips**
   - Keep the tone friendly and casual
   - Maintain the "local radio" feeling
   - Consider character length (buttons, labels)
   - Test in the actual UI

**Example Structure:**
```json
{
  "app.title": "Brummies Rock Radio",
  "search.placeholder": "Search for stations...",
  "player.play": "Play",
  "player.pause": "Pause",
  "distance.km": "{distance} km away",
  "distance.noData": "No GPS Data"
}
```

---

## 📚 Documentation

When adding features, update:
- **README.md** — Main documentation
- **Code comments** — Explain complex logic
- **CHANGELOG.md** — Document changes

---

## 🚫 What NOT to Contribute

Please don't submit PRs for:
- Dependencies without discussion
- Major architectural changes without proposal
- Unrelated features that don't fit the app's purpose
- Minified code (we minify during build)
- Breaking changes without migration path

---

## 💬 Communication

- **GitHub Issues** — Bug reports, feature requests
- **Pull Requests** — Code contributions
- **Discussions** — General questions, ideas

---

## 🎯 Project Philosophy

Keep these principles in mind:

1. **Think Globally, Listen Locally**
   - Features should support the "local discovery" mission
   - Don't sacrifice the local feeling for global features

2. **Simplicity First**
   - Keep the UI clean and intuitive
   - Don't add complexity without clear benefit

3. **Performance Matters**
   - Fast load times
   - Smooth animations
   - Efficient code

4. **Accessibility**
   - Keyboard navigation
   - Screen reader support
   - Touch-friendly (min 44px targets)

5. **Privacy Focused**
   - No tracking
   - No ads
   - Local data only

---

## 📝 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## 🙏 Thank You!

Your contributions help make radio listening more connected and personal for users worldwide.

**Happy coding! 🎸🎵**
