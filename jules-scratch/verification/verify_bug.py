import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        file_path = os.path.abspath('index.html')
        await page.goto(f'file://{file_path}')

        # Set a narrow viewport
        await page.set_viewport_size({"width": 375, "height": 667})

        # --- Manually force the app into the state described by the user ---
        await page.evaluate("""
            // 1. Show the preferences screen
            document.getElementById('welcomeScreen').classList.remove('active');
            document.getElementById('preferencesScreen').classList.add('active');

            // 2. Show the user status with a long name
            document.getElementById('user-status').classList.remove('hidden');
            document.getElementById('user-name').textContent = 'Olá, Maximiliano!';

            // 3. Simulate the movie grid loading by adding dummy elements
            const grid = document.getElementById('movie-grid-suggestions');
            for (let i = 0; i < 12; i++) {
                const movieEl = document.createElement('div');
                movieEl.className = 'aspect-[2/3] bg-gray-700 rounded-lg';
                grid.appendChild(movieEl);
            }
        """)

        # Wait for the elements to be visible to ensure the DOM is updated
        await expect(page.locator("#preferencesScreen")).to_be_visible()
        await expect(page.get_by_text("Olá, Maximiliano!")).to_be_visible()
        await expect(page.locator("#movie-grid-suggestions > div")).to_have_count(12)

        # Add a small delay for any potential layout shift to settle
        await page.wait_for_timeout(500)

        # Take the screenshot to capture the state of the UI
        user_status_element = page.locator("#user-status")
        await user_status_element.screenshot(path="jules-scratch/verification/bug_screenshot_fixed.png")

        await browser.close()

asyncio.run(main())
