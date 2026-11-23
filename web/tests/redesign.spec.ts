import {expect,test} from "@playwright/test";

test("the redesign preview filters workshops and preserves the selected language in Learn",async({page})=>{
  await page.goto("/redesign");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Un día para crear.");
  const image=page.locator(".hero-img img");
  await expect.poll(()=>image.evaluate((element: HTMLImageElement)=>element.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("combobox",{name:"Idioma"}).selectOption("en");
  await page.getByRole("searchbox",{name:"Search workshops"}).fill("rug");
  const catalogue=page.locator("#ty-grid");
  await expect(catalogue.getByRole("article")).toHaveCount(1);
  await catalogue.getByRole("button",{name:"View workshop"}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("link",{name:"Book in Learn"})).toHaveAttribute("href",/\/en\/learn\?taller=5$/);
});
