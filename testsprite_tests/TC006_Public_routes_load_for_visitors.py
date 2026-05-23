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
        
        # -> Navigate to /health and verify a successful health response is visible.
        await page.goto("http://127.0.0.1:4173/health")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /ready and verify a successful readiness response is visible.
        await page.goto("http://127.0.0.1:4173/ready")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /demo/playwright and verify the demo page is visible (then proceed to /test to confirm the internal route is not exposed).
        await page.goto("http://127.0.0.1:4173/demo/playwright")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /test and verify the internal test route is not exposed (confirm an error/404 or no access).
        await page.goto("http://127.0.0.1:4173/test")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # --> Test failed (AST guard fallback)
        raise AssertionError("Test failed during agent run: " + "TEST FAILURE The internal test route (/test) is exposed to the public \u2014 it is reachable and renders interactive test controls, which violates the expectation that internal routes are not publicly accessible. Observations: - Navigated to /test and the page shows the heading 'Remote Functions Test' with login fields and many interactive API test buttons. - The /health endpoint returned {\"status\":...")
        await asyncio.sleep(5)
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    