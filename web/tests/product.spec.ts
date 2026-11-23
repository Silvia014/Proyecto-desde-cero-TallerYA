import {expect,test} from "@playwright/test";

test("Spanish and English catalogue, venue and public SEO",async({page})=>{
  await page.goto("/es");
  await expect(page.locator("html")).toHaveAttribute("lang","es");
  await expect(page.getByRole("heading",{level:1})).toContainText("Bogotá");
  await expect(page.getByText("Casa Arcilla · Chapinero").first()).toBeVisible();
  await expect(page.getByText("Datos de prueba").first()).toBeVisible();
  const schema=await page.locator("script[type='application/ld+json']").evaluate(node=>JSON.parse(node.textContent ?? "{}"));
  expect(schema["@graph"][0]["@type"]).toBe("WebSite");
  await page.getByRole("link",{name:"English",exact:true}).click();
  await expect(page.locator("html")).toHaveAttribute("lang","en");
  await expect(page.getByRole("heading",{name:"Upcoming workshops"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Ceramics by hand"})).toBeVisible();
});

test("demo admin sees registrations, popularity, earnings, users and certificates",async({page})=>{
  await page.goto("/es/learn");
  await page.getByLabel("Correo electrónico").fill("owner@example.com");
  await page.getByLabel(/Contraseña/).fill("Demo-TallerYA-5678");
  await page.getByRole("button",{name:"Entrar",exact:true}).click();
  for(const name of ["Talleres populares","Panel de ganancias","Agenda de cursos","Gestionar inscripciones","Usuarios","Certificados PDF"]){
    await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();
  }
  await expect(page.getByRole("table",{name:"Talleres populares"})).toContainText("Cerámica a mano");
  await expect(page.getByRole("table",{name:"Panel de ganancias"})).toContainText("COP");
  await expect(page.getByText("Demo Alumna").first()).toBeVisible();
  const search = page.getByRole("searchbox",{name:"Buscar inscripciones"});
  await search.fill("registro inexistente");
  await expect(page.getByText("No hay inscripciones que coincidan.")).toBeVisible();
  await search.clear();
  await expect(page.getByText("Demo Alumna").first()).toBeVisible();
  await expect(page.getByRole("table",{name:"Panel de ganancias"})).toHaveScreenshot("earnings.png",{animations:"disabled"});
});

test("demo student downloads their own PDF",async({page})=>{
  await page.goto("/en/learn");
  await page.getByLabel("Email", {exact:true}).fill("student@example.com");
  await page.getByLabel(/Password/).fill("Demo-TallerYA-5678");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  const [download]=await Promise.all([
    page.waitForEvent("download"),page.getByRole("link",{name:"Download PDF certificate"}).click(),
  ]);
  expect(download.suggestedFilename()).toBe("certificado.pdf");
});

for (const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  test(`landing visual ${viewport.width}`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.goto("/es");
    await expect(page.getByText("Casa Arcilla · Chapinero").first()).toBeVisible();
    await page.locator("time").evaluateAll(nodes=>{
      for(const node of nodes) node.textContent="12 nov 2026, 12:00";
    });
    await expect(page).toHaveScreenshot(`landing-${viewport.width}.png`,{animations:"disabled",fullPage:true});
  });
}

test("the landing and Learn share the TallerYA palette", async ({page}) => {
  await page.goto("/en");
  const hero = page.getByRole("heading", {level:1}).locator("xpath=ancestor::section[1]");
  await expect(hero).toHaveCSS("background-color", "rgb(102, 51, 0)");
  await expect(hero.getByRole("link", {name:"Browse workshops"})).toHaveCSS("background-color", "rgb(255, 204, 153)");
  await page.goto("/en/learn");
  await expect(page.getByRole("button", {name:"Sign in",exact:true})).toHaveCSS("background-color", "rgb(102, 51, 0)");
});

test("teachers use Learn to see their assigned courses without owner controls", async ({page}) => {
  await page.goto("/en/learn");
  await page.getByLabel("Email", {exact:true}).fill("teacher@example.com");
  await page.getByLabel(/Password/).fill("Demo-TallerYA-5678");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Workshop schedule"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Ceramics by hand"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Users",exact:true})).toHaveCount(0);
});
