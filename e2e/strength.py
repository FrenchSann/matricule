"""Musculation et modification du plan, au format iPhone (serveur de dev :5173, horloge simulée)."""
import os, datetime
from playwright.sync_api import sync_playwright, expect

OUT = os.path.join(os.path.dirname(__file__), "shots")
SAFE = ":root{--safe-top:47px!important;--safe-bottom:34px!important}"
T0 = datetime.datetime(2026, 10, 12, 18, 0)  # lundi : Force A

def shot(page, name, full=False):
    page.add_style_tag(content=SAFE); page.wait_for_timeout(450)
    page.screenshot(path=f"{OUT}/{name}.png", full_page=full); print("shot", name)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(**p.devices["iPhone 14"], locale="fr-FR", timezone_id="Europe/Paris")
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errs.append(m.text))
    page.clock.install(time=T0)
    page.goto("http://localhost:5173/")
    page.get_by_role("button", name="Ouvrir le carnet").click(); page.wait_for_timeout(700)
    shot(page, "20-today-force")

    # Séance 1 : consigner la Force A avec les charges
    page.locator("article.session", has_text="Force A").get_by_role("button", name="Consigner").click()
    sheet = page.locator(".sheet")
    sheet.get_by_role("button", name="7", exact=True).click()
    sheet.get_by_role("textbox", name="Squat goblet, série 1 : charge").fill("16")  # se propage aux séries 2 à 4
    sheet.get_by_role("textbox", name="Tractions strictes, série 4 : reps").fill("5")
    sheet.locator(".exercise", has_text="Squat goblet").scroll_into_view_if_needed()
    shot(page, "21-log-strength")
    sheet.get_by_role("button", name="Consigner la séance").click()
    page.wait_for_timeout(1300)

    # Semaine suivante : la charge proposée doit avoir progressé
    page.clock.set_fixed_time(T0 + datetime.timedelta(days=7))
    page.reload(); page.wait_for_timeout(1200)
    plate = page.locator("article.session", has_text="Force A")
    print("TODAY LIST:", plate.locator(".ex-list").inner_text().replace("\n", " | "))
    plate.scroll_into_view_if_needed(); shot(page, "22-today-suggested")
    plate.get_by_role("button", name="Consigner").click()
    print("HINT:", page.locator(".sheet .exercise", has_text="Squat goblet").locator(".exercise-hint").inner_text())
    page.locator(".sheet").get_by_role("button", name="9", exact=True).click()
    page.locator(".sheet").get_by_role("button", name="Consigner la séance").click()
    page.wait_for_timeout(1300)

    # Semaine type : modifier la Force A (ajout du développé couché) et l'appliquer
    page.get_by_role("button", name="Plan", exact=True).click()
    page.get_by_role("button", name="Modifier la semaine type").click()
    shot(page, "23-template")
    page.locator(".sheet .mini-session", has_text="Force B").click()
    sheet = page.locator(".sheet")
    sheet.get_by_role("button", name="+ Ajouter un exercice").click()
    sheet.get_by_role("combobox", name="Exercice 5").fill("Développé couché")
    sheet.get_by_role("textbox", name="Développé couché : charge de départ").fill("40")
    sheet.get_by_role("textbox", name="Développé couché : charge de départ").scroll_into_view_if_needed()
    shot(page, "24-template-edit")
    sheet.get_by_role("button", name="Enregistrer").click()
    page.get_by_role("button", name="Appliquer aussi à cette semaine, dès aujourd'hui").click()
    page.wait_for_timeout(400)
    page.locator(".sheet").get_by_role("button", name="Fermer").click()

    # Ajouter une séance le jeudi, supprimer la mobilité du mercredi
    page.get_by_role("button", name="Ajouter une séance le jeudi 22 oct.").click()
    page.locator(".sheet").get_by_role("button", name="MOB Mobilité").click()
    page.locator(".sheet").get_by_role("button", name="Ajouter au plan").click()
    page.wait_for_timeout(300)
    page.locator(".mini-session", has_text="Mobilité").first.click()
    page.locator(".sheet").get_by_role("button", name="Modifier").click()
    page.locator(".sheet").get_by_role("button", name="Supprimer cette séance").click()
    page.wait_for_timeout(300)
    vendredi = page.locator(".day", has_text="Vendredi 23 oct.")
    vendredi.scroll_into_view_if_needed()
    print("FORCE B:", vendredi.inner_text().replace("\n", " | "))
    shot(page, "25-plan-edited")

    page.get_by_role("button", name="Stats").click()
    page.get_by_role("heading", name="Musculation").scroll_into_view_if_needed()
    page.locator(".chip", has_text="Squat goblet").click()
    shot(page, "26-stats-strength")
    print("ERRORS:", errs or "none")
    browser.close()
