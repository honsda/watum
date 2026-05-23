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
        
        # -> Navigate to /health and verify the health check succeeds (expect a 200/OK or a visible success message).
        await page.goto("http://localhost:4173/health")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /ready and verify the readiness check succeeds (look for a JSON status or visible success message).
        await page.goto("http://localhost:4173/ready")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /ready and verify the readiness check succeeds (look for a JSON status or visible success message).
        await page.goto("http://localhost:4173/demo")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /ready and verify the readiness check succeeds (look for a JSON status or visible success message).
        await page.goto("http://localhost:4173/demo/playwright")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /ready and verify the readiness check returns a success JSON or visible success message.
        await page.goto("http://localhost:4173/ready")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /demo and verify the demo page is displayed, then visit /demo/playwright to verify Playwright demo, and finally visit /test to confirm the internal test route is not exposed.
        await page.goto("http://localhost:4173/demo")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /demo and verify the demo page is displayed, then visit /demo/playwright to verify Playwright demo, and finally visit /test to confirm the internal test route is not exposed.
        await page.goto("http://localhost:4173/demo/playwright")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Navigate to /demo and verify the demo page is displayed, then visit /demo/playwright to verify Playwright demo, and finally visit /test to confirm the internal test route is not exposed.
        await page.goto("http://localhost:4173/test")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # --> Test failed (AST guard fallback)
        raise AssertionError("Test failed during agent run: " + "TEST FAILURE The internal test route is publicly accessible \u2014 it should not be exposed. Observations: - The /test page is accessible and shows a 'Remote Functions Test' interface with forms and buttons. - The /health endpoint returned visible JSON {\"status\":\"ok\"}. - The /ready endpoint returned visible JSON {\"status\":\"ready\"} and the demo routes (/demo and /demo/playwright) are accessible.")
        await asyncio.sleep(5)
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    