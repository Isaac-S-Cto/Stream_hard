import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        file_path = os.path.abspath('index.html')
        await page.goto(f'file://{file_path}')

        # Set a narrow viewport to test the wrapping
        await page.set_viewport_size({"width": 375, "height": 667})

        # Manually trigger the UI update with a long name to make the user status visible
        await page.evaluate("""
            const user = { displayName: 'Maximiliano da Silva', isAnonymous: false };
            const userStatusDiv = document.getElementById('user-status');
            const userNameP = document.getElementById('user-name');

            userStatusDiv.classList.remove('hidden');
            const displayName = user.displayName ? user.displayName.split(' ')[0] : 'Visitante';
            userNameP.textContent = `Olá, ${displayName}!`;
        """)

        # Wait for the element to be visible
        await expect(page.locator("#user-status")).to_be_visible()
        await expect(page.get_by_text("Olá, Maximiliano!")).to_be_visible()

        # Take a screenshot of the user status component
        user_status_element = page.locator("#user-status")
        await user_status_element.screenshot(path="jules-scratch/verification/screenshot_final_fix.png")

        await browser.close()

asyncio.run(main())
