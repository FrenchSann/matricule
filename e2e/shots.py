"""Captures au format iPhone (390x844, DPR 3) avec encoche simulée (safe areas 47/34 px)."""
import sys, os
from playwright.sync_api import sync_playwright

URL = "http://localhost:4173/"
OUT = os.path.join(os.path.dirname(__file__), "shots")
os.makedirs(OUT, exist_ok=True)
SAFE = ":root{--safe-top:47px!important;--safe-bottom:34px!important}"
steps = sys.argv[1:] or ["onboarding", "today", "plan", "log", "dossier"]

with sync_playwright() as p:
    browser = p.chromium.launch()
    iphone = p.devices["iPhone 14"]
    ctx = browser.new_context(**iphone, locale="fr-FR", timezone_id="Europe/Paris")
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))

    def shot(name, full=False):
        page.add_style_tag(content=SAFE)
        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/{name}.png", full_page=full)
        print("shot", name)

    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts.ready")
    if "onboarding" in steps: shot("01-onboarding", True)
    page.get_by_role("button", name="Ouvrir le carnet").click()
    page.wait_for_timeout(600)
    if "today" in steps: shot("02-today")
    if "plan" in steps:
        page.get_by_role("button", name="Plan", exact=True).click(); shot("03-plan")
        page.locator(".mini-session:not([disabled])").first.click(); shot("04-plan-sheet")
        page.get_by_role("button", name="Fermer").click()
    if "log" in steps:
        page.get_by_role("button", name="Consigner une séance").click(); shot("05-log")
        page.get_by_role("button", name="7", exact=True).click()
        page.get_by_role("button", name="Oui, une douleur").click()
        page.get_by_role("button", name="Genou").click(); shot("06-log-filled")
        page.get_by_role("button", name="Consigner la séance").click()
        page.wait_for_timeout(250); shot("07-stamp")
        page.wait_for_timeout(1200)
        page.get_by_role("button", name="Aujourd'hui").click(); shot("08-today-after")
    if "dossier" in steps:
        page.get_by_role("button", name="Dossier").click(); shot("09-dossier")
    if "stats" in steps:
        page.get_by_role("button", name="Stats").click(); shot("10-stats")
    print("ERRORS:", errors or "none")
    browser.close()
