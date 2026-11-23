import {expect,test} from "@playwright/test";

test("Spanish and English catalogue, venue and public SEO",async({page})=>{
  await page.goto("/es");
  await expect(page.locator("html")).toHaveAttribute("lang","es");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Un día para crear.");
  await expect(page.getByText("Casa Arcilla · Chapinero").first()).toBeVisible();
  await expect(page.getByText("Catálogo de demostración").first()).toBeVisible();
  const schema=await page.locator("script[type='application/ld+json']").evaluate(node=>JSON.parse(node.textContent ?? "{}"));
  expect(schema["@graph"][0]["@type"]).toBe("WebSite");
  await page.getByRole("combobox",{name:"Idioma"}).selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang","en");
  await expect(page.getByRole("heading",{name:"Find your next workshop"})).toBeVisible();
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
      nodes.forEach((node,index)=>{node.textContent=index%2===0?"12 nov 2026, 12:00":"15:00";});
    });
    await page.locator("main img").evaluateAll(images=>Promise.all(images.map(image=>(image as HTMLImageElement).decode())));
    await expect(page).toHaveScreenshot(`landing-${viewport.width}.png`,{animations:"disabled",fullPage:true});
  });
}

test("the landing and Learn share the TallerYA palette", async ({page}) => {
  await page.goto("/en");
  const hero = page.getByRole("heading", {level:1}).locator("xpath=ancestor::section[1]");
  await expect(hero).toHaveCSS("background-color", "rgb(102, 51, 0)");
  await expect.poll(()=>hero.locator("img").evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
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

test("the demo explains workshop projects, group visits and the illustrative gallery in both languages", async ({page}) => {
  await page.goto("/en");
  for (const title of ["Rug making", "Personal development", "Clay hand-building", "Handcrafted shoes", "Handmade cups"]) {
    const card = page.getByRole("article").filter({has: page.getByRole("heading",{name:title,exact:true})});
    await expect(card).toContainText("20 places");
    await expect(card).toContainText("COP");
    await card.getByRole("button",{name:"View workshop"}).click();
    const detail=page.getByRole("dialog");
    await expect(detail.locator("time")).toHaveCount(2);
    await expect(detail).toContainText("You’ll make");
    await detail.getByRole("button",{name:"Close"}).click();
  }
  await expect(page.getByRole("heading",{name:"What to expect"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Come with a group"})).toBeVisible();
  const gallery = page.getByRole("region",{name:"Workshop gallery"});
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery.getByRole("img")).toHaveCount(3);
  await expect.poll(()=>gallery.getByRole("img").first().evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("combobox",{name:"Language"}).selectOption("es");
  await expect(page.getByRole("heading",{name:"Qué esperar"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Creación de alfombras"})).toHaveCount(1);
});

test("registration password can be revealed and hidden",async({page})=>{
  await page.goto("/en/learn?taller=1");
  await page.getByRole("button",{name:"Create account",exact:true}).click();
  const password=page.locator('input[name="password"]');
  await expect(password).toHaveAttribute("type","password");
  await page.getByRole("button",{name:"Show password"}).click();
  await expect(password).toHaveAttribute("type","text");
  await page.getByRole("button",{name:"Hide password"}).click();
  await expect(password).toHaveAttribute("type","password");
  await page.getByRole("combobox",{name:"Language"}).selectOption("es");
  await expect(page).toHaveURL(/\/es\/learn\?taller=1$/);
});
