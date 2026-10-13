"""Parcours du programme 58 semaines au format iPhone (serveur de dev :5173, horloge simulée)."""
import os, datetime
from playwright.sync_api import sync_playwright, expect

OUT = os.path.join(os.path.dirname(__file__), "shots")
os.makedirs(OUT, exist_ok=True)
SAFE = ":root{--safe-top:47px!important;--safe-bottom:34px!important}"
D = lambda m, d, h=17: datetime.datetime(2026, m, d, h, 0)

def shot(page, name, full=False):
    page.add_style_tag(content=SAFE); page.wait_for_timeout(450)
    page.screenshot(path=f"{OUT}/{name}.png", full_page=full); print("shot", name)

def at(page, when):
    page.clock.set_fixed_time(when); page.evaluate("history.replaceState(null, '', '#today')"); page.reload(); page.wait_for_timeout(1100)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(**p.devices["iPhone 14"], locale="fr-FR", timezone_id="Europe/Paris")
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errs.append(m.text))
    page.clock.install(time=D(10, 13))
    page.goto("http://localhost:5173/")
    page.wait_for_timeout(800)
    shot(page, "30-onboarding", True)
    page.get_by_role("button", name="Ouvrir le carnet").click(); page.wait_for_timeout(800)
    shot(page, "31-today-before")

    # Lundi S01 : salle A
    at(page, D(10, 19, 15))
    shot(page, "32-today-s01")
    page.locator("article.session", has_text="Salle A").get_by_role("button", name="Consigner").click()
    sheet = page.locator(".sheet")
    sheet.get_by_role("button", name="7", exact=True).click()
    sheet.get_by_role("textbox", name="Développé couché, série 1 : reps").fill("8")
    sheet.get_by_role("textbox", name="Développé couché, série 1 : charge").fill("40")
    sheet.get_by_role("textbox", name="Développé couché, série 1 : charge").scroll_into_view_if_needed()
    shot(page, "33-log-salle-a")
    sheet.get_by_role("button", name="Consigner la séance").click(); page.wait_for_timeout(1300)

    # Personnaliser : variante de squat appliquée à la semaine
    page.get_by_role("button", name="Plan", exact=True).click()
    shot(page, "34-plan-s01")
    page.get_by_role("button", name="Personnaliser le programme").click()
    page.get_by_label("Squat (variante conservée)").fill("Squat barre")
    page.get_by_label("Squat (variante conservée)").blur()
    page.get_by_role("button", name="Appliquer aussi à cette semaine, dès aujourd'hui").click()
    shot(page, "35-customize")
    page.locator(".sheet").get_by_role("button", name="Fermer", exact=True).last.click()
    page.locator(".mini-session", has_text="Salle B").click()
    print("SALLE B:", page.locator(".sheet .ex-list li").first.inner_text().replace("\n", " "))
    page.locator(".sheet").get_by_role("button", name="Fermer").first.click()

    # Jeudi : option du 4e grappling
    at(page, D(10, 22, 12))
    page.locator("article.session", has_text="Course").get_by_role("button", name="Option : 4e grappling (20 h 20) à la place, sans piscine samedi").click()
    page.wait_for_timeout(500)
    shot(page, "36-thursday-grappling4")

    # Dimanche : décision
    at(page, D(10, 25, 18))
    card = page.locator("section", has=page.get_by_role("heading", name="Décision du dimanche"))
    card.get_by_role("button", name="4", exact=True).click()
    card.get_by_role("textbox", name="Sommeil moyen").fill("8,5")
    shot(page, "37-checkin")
    card.get_by_role("button", name="Valider").click(); page.wait_for_timeout(1300)

    # Lundi S02 : charge proposée
    at(page, D(10, 26, 15))
    plate = page.locator("article.session", has_text="Salle A")
    print("S02 COUCHÉ:", plate.locator(".ex-list li").first.inner_text().replace("\n", " "))
    print("HEADER:", page.locator(".orders-meta").inner_text().replace("\n", " | "))
    plate.scroll_into_view_if_needed(); shot(page, "38-today-s02")

    # Repères de départ
    page.get_by_role("button", name="Dossier").click()
    page.locator("article", has_text="Repères de départ").get_by_role("button", name="Noter les mesures").click()
    s = page.locator(".sheet")
    s.get_by_role("textbox", name="Tractions propres (série de référence)").fill("5")
    s.get_by_role("textbox", name="Distance en 6 min").fill("1350")
    s.get_by_label("400 m crawl").fill("8:40")
    s.get_by_role("textbox", name="Développé couché : charge").fill("40")
    s.get_by_role("textbox", name="Développé couché : répétitions").fill("8")
    shot(page, "39-bilan-form")
    s.get_by_role("button", name="Enregistrer le bilan").click(); page.wait_for_timeout(500)
    print("BILANS:", page.evaluate("db.bilans.toArray().then(JSON.stringify)"), errs)
    shot(page, "40-dossier")
    page.get_by_role("button", name="Stats").click()
    page.get_by_role("heading", name="Tableau des bilans").scroll_into_view_if_needed()
    shot(page, "41-stats")
    print("ERRORS:", errs or "none")
    browser.close()
