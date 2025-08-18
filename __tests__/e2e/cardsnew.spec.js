const { test, expect } = require('@playwright/test');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS LINE

test('New Grid test (cards.html)', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto(`${baseURL}/public/cards.html`);

 const container = page.locator('#mount > div'); // flex container
  await expect(container).toHaveCount(1);

  const cards = container.locator(':scope > div'); // individual grid items
  await expect(cards).toHaveCount(3);

  const cardData = [
    { title: "Starship", href: "#ship", img: "https://upload.wikimedia.org/wikipedia/commons/3/3a/Starship_S20.jpg" },
    { title: "Saturn V", href: "#saturn", img: "https://upload.wikimedia.org/wikipedia/commons/1/16/Apollo_11_Launch_-_GPN-2000-000630.jpg" },
    { title: "Shuttle", href: "#shuttle", img: "https://upload.wikimedia.org/wikipedia/commons/d/d6/STS120LaunchHiRes-edit1.jpg" }
  ];

for (let i = 0; i < 3; i++) {
    const card = cards.nth(i);

   
    // Check the background image
    const imgDiv = card.locator('div:nth-child(1)');
    await expect(imgDiv).toHaveAttribute('style', new RegExp(cardData[i].img));

    // Check the title
    const title = card.locator('h5');
    await expect(title).toHaveText(cardData[i].title);

    // Check the link
    const link = card.locator('a');
    await expect(link).toHaveText(cardData[i].title);
    await expect(link).toHaveAttribute('href', cardData[i].href);
  }
 
});
