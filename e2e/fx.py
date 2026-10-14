"""Captures des effets visuels (impacts, douilles, promotion) au format iPhone, serveur de dev :5173."""
import os, datetime
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(__file__), "shots")
os.makedirs(OUT, exist_ok=True)
SAFE = ":root{--safe-top:47px!important;--safe-bottom:34px!important}"
D = lambda d, h=17: datetime.datetime(2026, 10, d, h, 0)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(**p.devices["iPhone 14"], locale="fr-FR", timezone_id="Europe/Paris")
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.clock.install(time=D(13))
    page.goto("http://localhost:5173/"); page.wait_for_timeout(800)
    page.add_style_tag(content=SAFE)
    page.screenshot(path=f"{OUT}/50-onboarding.png")
    page.get_by_role("button", name="Ouvrir le carnet").click(); page.wait_for_timeout(600)

    # Mercredi 21 : lundi fait (2 séances), mardi repos → douilles
    page.clock.set_fixed_time(D(19, 20)); page.reload(); page.wait_for_timeout(900)
    while page.get_by_role("button", name="Marquer comme faite").count():
        page.get_by_role("button", name="Marquer comme faite").first.click(); page.wait_for_timeout(1500)
    page.clock.set_fixed_time(D(21, 12)); page.reload(); page.wait_for_timeout(1000)
    page.add_style_tag(content=SAFE)
    page.screenshot(path=f"{OUT}/51-today.png")

    # Impact en cours sur la salle B
    plate = page.locator("article.session", has_text="Salle B")
    plate.scroll_into_view_if_needed()
    plate.get_by_role("button", name="Marquer comme faite").click()
    page.wait_for_timeout(230)
    page.screenshot(path=f"{OUT}/52-impact.png")
    page.wait_for_timeout(1600)
    plate.scroll_into_view_if_needed()
    page.screenshot(path=f"{OUT}/53-after.png")

    page.get_by_role("button", name="Plan", exact=True).click(); page.wait_for_timeout(600)
    page.locator(".day", has_text="Lundi 19 oct.").scroll_into_view_if_needed()
    page.screenshot(path=f"{OUT}/54-plan.png")

    print("ERRORS:", errs or "none")
    browser.close()
