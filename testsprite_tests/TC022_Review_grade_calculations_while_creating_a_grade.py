import asyncio
import re
from playwright import async_api
from playwright.async_api import expect


async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process",
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:4173/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # -> Fill the email and password fields with admin@watum.local / admin123 and submit the login form.
        # email input name="email"
        elem = page.locator("xpath=/html/body/div/div/div/div[2]/form/div/input").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin@watum.local")

        # -> Fill the email and password fields with admin@watum.local / admin123 and submit the login form.
        # password input name="password"
        elem = page.locator(
            "xpath=/html/body/div/div/div/div[2]/form/div[2]/input"
        ).nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("admin123")

        # -> Fill the email and password fields with admin@watum.local / admin123 and submit the login form.
        # button "Masuk"
        elem = page.locator("xpath=/html/body/div/div/div/div[2]/form/button").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.click()

        # -> Click the 'Nilai' (Grades) navigation button to open the Grades page and reveal the grade form/list.
        await page.get_by_role("button", name="Nilai").click()

        # -> Click the 'Tambah' (Add) button to open the grade creation form.
        await page.get_by_role("button", name="Tambah").click()

        # -> Select the dedicated safe TC022 enrollment. It has no grade before this test runs.
        enrollment_select = page.locator("select[name='enrollmentId']")
        await expect(
            page.locator("select[name='enrollmentId'] option[value='000_TC022_ENROLL']")
        ).to_have_count(1)
        await enrollment_select.select_option("000_TC022_ENROLL")

        # -> Change the Tugas/UTS/UAS inputs to new values and verify the live calculation.
        await page.locator("input[name='n:assignmentScore']").fill("90")
        await page.locator("input[name='n:midtermScore']").fill("85")
        await page.locator("input[name='n:finalScore']").fill("75")
        await expect(page.get_by_text("Nilai Akhir: 82.5")).to_be_visible()
        await expect(page.get_by_text("B", exact=True)).to_be_visible()

        # -> Save the grade, then search for the newly persisted row.
        await page.get_by_role("button", name="Simpan nilai").click()
        await expect(page.get_by_text("Nilai baru berhasil disimpan.")).to_be_visible()
        await page.get_by_label("Cari data nilai").fill("000 TC022 Grade Student")

        # --> Assertions to verify final persisted state
        await expect(page.get_by_text("000 TC022 Grade Student")).to_be_visible()
        await expect(page.get_by_text("000 TC022 Grade Course")).to_be_visible()
        await expect(page.get_by_text("82.5 poin")).to_be_visible()
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()


asyncio.run(run_test())
