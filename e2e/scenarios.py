"""Scénarios bout en bout au format iPhone : hors ligne, sauvegarde, promotion, tests de contrôle."""
import os, datetime
from playwright.sync_api import sync_playwright, expect

OUT = os.path.join(os.path.dirname(__file__), "shots")
SAFE = ":root{--safe-top:47px!important;--safe-bottom:34px!important}"
T0 = datetime.datetime(2026, 10, 12, 9, 0)  # lundi

def new_page(p, browser):
    ctx = browser.new_context(**p.devices["iPhone 14"], locale="fr-FR", timezone_id="Europe/Paris", accept_downloads=True)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errs.append(m.text))
    return ctx, page, errs

def shot(page, name):
    page.add_style_tag(content=SAFE); page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/{name}.png"); print("shot", name)

with sync_playwright() as p:
    browser = p.chromium.launch()

    # 1. Hors ligne (build de production)
    ctx, page, errs = new_page(p, browser)
    page.goto("http://localhost:4173/")
    page.get_by_role("button", name="Ouvrir le carnet").click()
    page.wait_for_function("navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(()=>true)")
    page.evaluate("navigator.serviceWorker.ready")
    page.reload(); page.wait_for_timeout(800)
    ctx.set_offline(True)
    page.reload(); page.wait_for_timeout(800)
    expect(page.get_by_role("heading", name="Ordre du jour")).to_be_visible()
    print("OFFLINE OK")
    ctx.set_offline(False)

    # 2. Export puis restauration
    page.get_by_role("button", name="Dossier").click()
    with page.expect_download() as dl:
        page.get_by_role("button", name="Exporter une sauvegarde").click()
    path = dl.value.path()
    print("EXPORT", dl.value.suggested_filename)
    page.locator("input[type=file]").set_input_files(path)
    expect(page.get_by_role("button", name="Remplacer par la sauvegarde")).to_be_visible()
    shot(page, "11-restore")
    page.get_by_role("button", name="Remplacer par la sauvegarde").click()
    page.wait_for_timeout(500)
    expect(page.get_by_role("heading", name="Grade et tests")).to_be_visible()
    print("RESTORE OK", errs or "")
    ctx.close()

    # 3. Promotion (dev : horloge simulée, deux semaines sans séance = repos tenus)
    ctx, page, errs = new_page(p, browser)
    page.clock.install(time=T0)
    page.goto("http://localhost:5173/")
    page.get_by_role("button", name="Ouvrir le carnet").click(); page.wait_for_timeout(600)
    page.evaluate("db.planned.clear()")
    page.clock.set_fixed_time(T0 + datetime.timedelta(days=14))
    page.reload(); page.wait_for_timeout(1000)
    page.evaluate("db.planned.where('date').below('2026-10-26').delete()")
    page.wait_for_timeout(1500)
    expect(page.get_by_role("heading", name="Soldat de 1re classe")).to_be_visible()
    shot(page, "12-promotion")
    page.get_by_role("button", name="Prendre le grade").click()

    # 4. Test de contrôle du mois 4 avec un échec
    page.clock.set_fixed_time(T0 + datetime.timedelta(weeks=16, days=2))
    page.reload(); page.wait_for_timeout(1200)
    shot(page, "13-today-checkpoint")
    page.get_by_role("button", name="Voir les tests").click()
    page.get_by_role("button", name="Saisir les résultats").click()
    page.get_by_label("Course 5 km").fill("26:10")
    page.get_by_role("button", name="Tractions strictes (cible 8) : plus 1").click(); page.get_by_role("textbox", name="Tractions strictes (cible 8)").fill("6")
    page.get_by_label("Marche 8 km").fill("1:15:00")
    page.get_by_label("Natation 200 m").fill("5:30")
    page.get_by_role("button", name="Réussie").click()
    shot(page, "14-checkpoint-form")
    page.get_by_role("button", name="Enregistrer les résultats").click()
    shot(page, "15-checkpoint-result")
    page.locator(".sheet").get_by_role("button", name="+3 semaines").click()
    page.wait_for_timeout(400)
    page.locator(".sheet").get_by_role("button", name="Fermer", exact=True).first.click()
    shot(page, "16-dossier-after")
    page.get_by_role("button", name="Stats").click(); shot(page, "17-stats")
    print("ERRORS:", errs or "none")
    browser.close()
