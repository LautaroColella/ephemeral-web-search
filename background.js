const CONTAINER_PREFIX = "Google No Account";

const tabContainers = new Map();

function makeGoogleURL(query) {
  return "https://www.google.com/search?q=" + encodeURIComponent(query);
}

async function createTemporaryContainer() {
  const identity = await browser.contextualIdentities.create({
    name: CONTAINER_PREFIX + " " + Date.now(),
    color: "blue",
    icon: "fingerprint",
  });

  console.log("Google No Account: created container:", identity.cookieStoreId);

  return identity.cookieStoreId;
}

async function removeContainer(cookieStoreId) {
  try {
    await browser.contextualIdentities.remove(cookieStoreId);

    console.log("Google No Account: removed container:", cookieStoreId);
  } catch (error) {
    console.error(
      "Google No Account: failed to remove container:",
      cookieStoreId,
      error,
    );
  }
}

async function isOurContainer(cookieStoreId) {
  try {
    const identity = await browser.contextualIdentities.get(cookieStoreId);

    return identity.name.startsWith(CONTAINER_PREFIX);
  } catch (_) {
    return false;
  }
}

async function cleanupContainer(cookieStoreId) {
  if (!cookieStoreId) {
    return;
  }

  if (!(await isOurContainer(cookieStoreId))) {
    return;
  }

  await removeContainer(cookieStoreId);
}

browser.omnibox.setDefaultSuggestion({
  description: "Search Google without your normal Google account",
});

browser.omnibox.onInputEntered.addListener(async (text, disposition) => {
  let cookieStoreId = null;

  try {
    const query = text.trim();

    if (!query) {
      return;
    }

    cookieStoreId = await createTemporaryContainer();

    const url = makeGoogleURL(query);

    const tab = await browser.tabs.create({
      url: url,
      cookieStoreId: cookieStoreId,
      active: disposition !== "newBackgroundTab",
    });

    tabContainers.set(tab.id, cookieStoreId);

    console.log(
      "Google No Account: created tab:",
      tab.id,
      "→ container:",
      cookieStoreId,
    );
  } catch (error) {
    console.error("Google No Account error:", error);

    if (cookieStoreId) {
      await removeContainer(cookieStoreId);
    }
  }
});

browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log("Google No Account: tab closed:", tabId);

  const cookieStoreId = tabContainers.get(tabId);

  if (!cookieStoreId) {
    console.log("Google No Account: tab was not one of ours.");

    return;
  }

  tabContainers.delete(tabId);

  console.log(
    "Google No Account: closed tab",
    tabId,
    "belonged to container",
    cookieStoreId,
  );

  await cleanupContainer(cookieStoreId);
});
