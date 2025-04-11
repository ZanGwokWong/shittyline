const puppeteer = require('puppeteer-core');

const skipKeywords = ['輪椅', '轮椅', 'Wheelchair', 'Barrier', "无障碍", "無障礙", '視線', "视线", "Restricted"];

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

        const degreeText = await label.evaluate(el => el.innerText);
        const shouldSkip = skipKeywords.some(keyword => degreeText.includes(keyword));
        if (shouldSkip) {
            continue;
        }

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
    const page = pages.find(p => p.url().includes('shows.cityline.com')) || pages[0];
    await page.setViewport(null);

    await page.waitForSelector('#buyTicketBtn', { timeout: 10000 });
    const buyButton = await page.$('#buyTicketBtn');

    // Click the button to open a new tab
    await buyButton.click();
    console.log('🔄 Waiting for verification...');
    console.log('⚠️ Please complete the verification code manually in the browser, then press any key on the keyboard to continue...');

    // Pause the script to allow the user to manually complete the verification
    await new Promise(resolve => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            resolve();
            console.log('✅ Continuing to execute the script...');
        });
    });

    // Find the tab containing perfId=
    const allPages = await browser.pages();
    const eventPage = allPages.find(p => p.url().includes('perfId='));
    await eventPage.setViewport(null);

    if (!eventPage) {
        console.log('❌ Could not find the ticket booking page, please confirm if the verification was successful');
        process.exit(1);
    }

    console.log('✅ Successfully found the ticket booking page');

    // Continue operations on the tab containing perfId=
    // Date selector loop
    while (true) {
        await eventPage.waitForSelector('.date-time-position', { timeout: 300000 });
        const dateButtons = await eventPage.$$('.date-time-position:not([disabled])');
        for (const dateBtn of dateButtons) {
            await eventPage.evaluate(el => el.click(), dateBtn);
            await new Promise(resolve => setTimeout(resolve, 500));
            await selectPriceAndBuy(eventPage);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// 🕗 Set the time for automatic ticket grabbing, for example 8:00 AM
const START_TIME = '12:27:00';

// 🕒 Get the current time and calculate the difference with the target time
function getTimeDiff(targetTime) {
    const [hour, minute, second] = targetTime.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hour, minute, second, 0);

    const diff = target - now;
    return diff > 0 ? diff : 0;  // If the target time has already passed, execute immediately
}

// ⏳ Main entry
(async () => {
    const delay = getTimeDiff(START_TIME);
    if (delay > 0) {
        console.log(`⏰ Waiting until ${START_TIME} to start ticket grabbing, ${Math.ceil(delay / 1000)} seconds remaining`);
        await new Promise(resolve => setTimeout(resolve, delay));
    } else {
        console.log('🎯 The specified time has passed, starting ticket grabbing immediately');
    }

    // Start executing the ticket grabbing process
    await startBookingFlow();
})();