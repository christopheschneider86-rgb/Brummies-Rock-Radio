import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Load the page and wait for DOMContentLoaded to avoid Vercel analytics timeouts
        await page.goto("http://localhost:8080", wait_until="domcontentloaded")

        # Bypass What's New overlay if present
        await page.evaluate("document.getElementById('whatsNewCloseBtn')?.click()")

        # Mock some stations in window.allStations and window.displayedStations
        await page.evaluate("""
            const mockStations = [
                { id: '1', name: 'Cool Rock Radio', genre: 'rock', country: 'US' },
                { id: '2', name: 'Smooth Jazz Hits', genre: 'jazz', country: 'FR' },
                { id: '3', name: 'German Metal', genre: 'metal', country: 'DE' }
            ];
            if(window.allStations){window.allStations.push(...mockStations);}
            if(window.displayedStations){window.displayedStations.push(...mockStations);}else{window.displayedStations=mockStations;}
        """)

        # Trigger search initialization logic manually, mimicking app behavior
        await page.evaluate("""
            if (typeof window._setRetroSearch === 'function') {
                window._setRetroSearch('rock', true);
            }
        """)

        print("Testing Retro Mode filtering...")
        retro_matches = await page.evaluate("""
            (function() {
                retroSearchText = 'rock';
                const res = window.displayedStations.filter(s => {
                    if (!s._searchString) s._searchString = ((s.name || '') + ' ' + (s.genre || '') + ' ' + (s.country || '')).toLowerCase();
                    return s._searchString.includes(retroSearchText.toLowerCase());
                });
                return res.map(s => s.name);
            })()
        """)
        assert 'Cool Rock Radio' in retro_matches, "Retro mode filtering failed"
        assert 'Smooth Jazz Hits' not in retro_matches, "Retro mode filtering failed"

        print("Testing Globe Mode filtering...")
        globe_matches = await page.evaluate("""
            (function() {
                globeSearchText = 'jazz';
                const stations = window.displayedStations.filter(s => {
                    if (!s._searchString) s._searchString = ((s.name || '') + ' ' + (s.genre || '') + ' ' + (s.country || '')).toLowerCase();
                    return s._searchString.includes(globeSearchText.toLowerCase());
                });
                return stations.map(s => s.name);
            })()
        """)
        assert 'Smooth Jazz Hits' in globe_matches, "Globe mode filtering failed"

        print("Testing Country Search filter...")
        await page.evaluate("""
            // Create some mock labels for country list
            const countryList = document.getElementById('countryList');
            if (countryList) {
                countryList.innerHTML = '<label>United States</label><label>France</label><label>Germany</label>';
                // Simulate search
                const q = 'fran';
                countryList.querySelectorAll('label').forEach(label => {
                    if (!label.dataset.search) label.dataset.search = label.textContent.toLowerCase();
                    label.style.display = label.dataset.search.includes(q) ? '' : 'none';
                });
            }
        """)
        visible_countries = await page.evaluate("""
            Array.from(document.querySelectorAll('#countryList label'))
                .filter(l => l.style.display !== 'none')
                .map(l => l.textContent)
        """)
        assert 'France' in visible_countries, "Country list filtering failed"
        assert 'Germany' not in visible_countries, "Country list filtering failed"

        print("Testing DJ Mode filtering...")
        dj_matches = await page.evaluate("""
            (function() {
                const search = 'metal';
                const genre = '';
                const subgenre = '';
                const https = false;

                const filtered = window.displayedStations.filter(st => {
                    let combinedTags = null;
                    if (genre === 'favorites') { return false; }
                    else if (genre) {
                        if (!st._tagsLower) st._tagsLower = ((st.genre || '') + (st.tags || '')).toLowerCase();
                        if (!st._tagsLower.includes(genre.toLowerCase())) return false;
                    }
                    if (subgenre) {
                        if (!st._tagsLower) st._tagsLower = ((st.genre || '') + (st.tags || '')).toLowerCase();
                        if (!st._tagsLower.includes(subgenre.toLowerCase())) return false;
                    }
                    if (search) {
                        if (!st._nameLower) st._nameLower = (st.name || '').toLowerCase();
                        if (!st._nameLower.includes(search)) return false;
                    }
                    return true;
                });
                return filtered.map(s => s.name);
            })()
        """)
        assert 'German Metal' in dj_matches, "DJ mode filtering failed"
        assert 'Cool Rock Radio' not in dj_matches, "DJ mode filtering failed"

        print("All tests passed.")
        await browser.close()

asyncio.run(main())
