"""Hors ligne et sauvegarde, sur le build de production (vite preview :4173)."""
import os
from playwright.sync_api import sync_playwright, expect

OUT = os.path.join(os.path.dirname(__file__), "shots")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(**p.devices["iPhone 14"], locale="fr-FR", timezone_id="Europe/Paris", accept_downloads=True)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto("http://localhost:4173/")
    page.get_by_role("button", name="Ouvrir le carnet").click()
    page.evaluate("navigator.serviceWorker.ready")
    page.reload(); page.wait_for_timeout(800)
    ctx.set_offline(True)
    page.reload(); page.wait_for_timeout(800)
    expect(page.get_by_role("heading", name="Ordre du jour")).to_be_visible()
    print("OFFLINE OK")
    ctx.set_offline(False)

    page.get_by_role("button", name="Dossier").click()
    with page.expect_download() as dl:
        page.get_by_role("button", name="Exporter une sauvegarde").click()
    page.locator("input[type=file]").set_input_files(dl.value.path())
    page.get_by_role("button", name="Remplacer par la sauvegarde").click()
    page.wait_for_timeout(500)
    expect(page.get_by_role("heading", name="Grade et bilans")).to_be_visible()
    print("RESTORE OK", errs or "")
    browser.close()
