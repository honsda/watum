import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        pw = await async_api.async_playwright().start()
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )
        context = await browser.new_context()
        context.set_default_timeout(15000)
        page = await context.new_page()
        # -> navigate
        await page.goto("http://localhost:4173/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /demo (http://127.0.0.1:4173/demo) and verify the demo page is visible.
        await page.goto("http://127.0.0.1:4173/demo")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Buka demo Playwright' link (element index 224) to open /demo/playwright and verify the Playwright demo page is visible.
        # link "Buka demo Playwright"
        elem = page.locator("xpath=/html/body/div/div/a").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()
        
        # -> Navigate to /demo/playwright (http://127.0.0.1:4173/demo/playwright) and verify the Playwright demo page is visible.
        await page.goto("http://127.0.0.1:4173/demo/playwright")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /test (http://127.0.0.1:4173/test) and verify the internal test route is not available to public visitors.
        await page.goto("http://127.0.0.1:4173/test")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # --> Test failed (AST guard fallback)
        raise AssertionError("Test failed during agent run: " + "TEST FAILURE The internal test route is publicly accessible \u2014 it should not be available to public visitors. Observations: - Navigating to /test returned a page titled 'Remote Functions Test' with visible auth/session controls and interactive test buttons. - The demo pages /demo and /demo/playwright are accessible and rendered as expected. - The /test page contains interactive elements such as ...")
        await asyncio.sleep(5)
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    