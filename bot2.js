const puppeteer = require('puppeteer-core');

async function selectPriceAndBuy(page) {
    await page.waitForSelector('.price', { timeout: 10000 });
    await page.waitForSelector('.form-check', { timeout: 10000 });

    const priceOptions = await page.$$('.form-check');

    for (let option of priceOptions) {
        await page.waitForSelector('.ticket-price-btn', { timeout: 10000 });
        const radioInput = await option.$('.ticket-price-btn');
        const label = await option.$('label');

        if (!label || !radioInput) {
            continue;
        }

        // Check if sold out
        const soldOut = await label.$('.price-limited span[data-i18n="status-title-soldout"]')
            .then(el => !!el)
            .catch(() => false);
        if (soldOut) {
            continue
        }

        // Check if the current ticket price is for wheelchair seats
        const degreeText = await label.evaluate(el => el.innerText);
        if (degreeText.includes('輪椅') || degreeText.includes("轮椅") || degreeText.includes("Wheelchair")) {
            continue;
        }

        // Check if temporarily out of tickets
        // const tempNoSeat = await label.$('span[data-i18n="HOLD_SEAT_PRICEZONE_TEMP_NO_SEAT"]')
        //     .then(el => !!el)
        //     .catch(() => false);

        // Use evaluate to ensure clicking within the page context
        await page.evaluate(el => el.click(), radioInput);
        // Add a short delay to ensure the click takes effect
        await new Promise(resolve => setTimeout(resolve, 500));
        // Verify if it's really selected
        const isChecked = await page.evaluate(el => el.checked, radioInput);
        if (!isChecked) {
            continue;
        }

        // Select quantity
        await page.waitForSelector('#ticketType0');
        const buttons = await page.$$('#expressPurchaseBtn');
        const availableQty = await page.$$eval('#ticketType0 option', opts =>
            opts.map(o => o.value).filter(v => v && v !== '0').reverse()
        );

        for (const qty of availableQty) {
            await page.select('#ticketType0', qty);
            for (const btn of buttons) {
                const text = await btn.evaluate(el => el.innerText);
                if (text.includes('快速購票') || text.includes('確定') || text.includes('确定') || text.includes('Express') || text.includes('Confirm') || text.includes("快速购票")) {
                    await page.evaluate(el => el.click(), btn);
                }
            }
        }
    }
}

async function startBookingFlow() {
    const browserURL = 'http://127.0.0.1:9222';
    const browser = await puppeteer.connect({ browserURL });
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('perfId=')) || pages[0];

    // Date selector loop
    while (true) {
        await page.waitForSelector('.date-time-position', { timeout: 300000 });
        const dateButtons = await page.$$('.date-time-position:not([disabled])');
        for (const dateBtn of dateButtons) {
            await page.evaluate(el => el.click(), dateBtn);
            await new Promise(resolve => setTimeout(resolve, 500));
            await selectPriceAndBuy(page);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// ⏳ Main entry
(async () => {
    await startBookingFlow();
})();