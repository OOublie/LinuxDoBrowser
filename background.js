let isRunning = false;
let visitedUrls = new Set();
let minTime = 10;
let maxTime = 30;
let maxPosts = 50;
let currentMode = 'autoLike'; // 'autoLike' or 'browseOnly'
let maxTimeMinutes = 60;
let startTime = null;
let postCount = 0;

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startOperation') { // Changed from 'startAutoLike' to 'startOperation'
    currentMode = message.mode; // 'autoLike' or 'browseOnly'
    minTime = message.minTime;
    maxTime = message.maxTime;
    // Determine maxPosts based on the mode
    if (currentMode === 'autoLike') {
      maxPosts = message.maxPosts;
    } else if (currentMode === 'browseOnly') {
      maxPosts = message.browseOnlyPosts; // Use browseOnlyPosts for browseOnly mode
    }
    maxTimeMinutes = message.maxTimeMinutes;
    isRunning = true;
    minTime = message.minTime;
    maxTime = message.maxTime;
    maxPosts = message.maxPosts;
    maxTimeMinutes = message.maxTimeMinutes;
    startTime = Date.now();
    postCount = 0;
    startOperation(); // Renamed from startAutoLike
  } else if (message.action === 'stopOperation') { // Changed from 'stopAutoLike' to 'stopOperation'
    isRunning = false;
    startTime = null;
  }
});

// 更新统计信息
async function updateStats() {
  if (startTime) {
    const runningMinutes = Math.floor((Date.now() - startTime) / 60000);
    await chrome.storage.local.set({
      postCount: postCount,
      startTime: startTime
    });
    chrome.runtime.sendMessage({
      action: 'updateStats',
      postCount: postCount,
      runningTime: runningMinutes
    });
  }
}

async function startOperation() { // Renamed from startAutoLike
  while (isRunning) {
    try {
      // 检查是否达到帖子数量上限
      if (postCount >= maxPosts) {
        isRunning = false;
        chrome.storage.local.set({ isRunning: false, startTime: null });
        chrome.runtime.sendMessage({ action: 'updateStats', postCount: postCount });
        break;
      }

      // 检查是否达到时间上限
      if (startTime && (Date.now() - startTime) >= maxTimeMinutes * 60 * 1000) {
        isRunning = false;
        chrome.storage.local.set({ isRunning: false, startTime: null });
        chrome.runtime.sendMessage({ action: 'updateStats', postCount: postCount });
        break;
      }

      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url.includes('linux.do')) {
        // 如果不在linux.do网站，打开主页
        await chrome.tabs.create({ url: 'https://linux.do' });
        await new Promise(resolve => setTimeout(resolve, 5000)); // 等待页面加载
        continue;
      }

      // 获取所有帖子链接
      const links = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          const links = Array.from(document.querySelectorAll('tr.topic-list-item td.main-link a.title'));
          return links.map(link => link.href);
        }
      });

      const postUrls = links[0].result;
      
      // 过滤掉已访问的链接
      const newUrls = postUrls.filter(url => !visitedUrls.has(url));
      
      if (newUrls.length === 0) {
        // 如果所有链接都已访问，清空已访问列表并重新开始
        visitedUrls.clear();
        continue;
      }

      // 随机选择一个新链接
      const randomUrl = newUrls[Math.floor(Math.random() * newUrls.length)];
      visitedUrls.add(randomUrl);

      // 打开新链接
      await chrome.tabs.update(tab.id, { url: randomUrl });
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待页面加载

      if (currentMode === 'autoLike') {
        // 执行主帖点赞操作
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'likePost' });
          await new Promise(resolve => setTimeout(resolve, 1000)); // 稍作等待

          // 执行评论点赞操作
          await chrome.tabs.sendMessage(tab.id, { action: 'likeComments' });
          await new Promise(resolve => setTimeout(resolve, 1000)); // 稍作等待
        } catch (e) {
          console.error('Error during liking operations on ' + tab.url + ':', e);
        }
        
        // 执行页面浏览操作 (whole page scroll for auto-like)
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'browsePage',
            minTime: minTime,
            maxTime: maxTime
          });
        } catch (e) {
          console.error('Error during page browse (autoLike) on ' + tab.url + ':', e);
        }
        postCount++; // 为自动点赞模式下处理的整个主题增加计数
        await updateStats();

      } else if (currentMode === 'browseOnly') {
        // 纯浏览模式：浏览单个帖子
        try {
          const tabId = tab.id; // Capture tab.id in case tab object changes
          const pageUrl = tab.url; // Capture tab.url for logging
          const postCountResponse = await chrome.tabs.sendMessage(tabId, { action: 'getPostCount' });
          
          if (postCountResponse && postCountResponse.count > 0) {
            const numPostsOnPage = postCountResponse.count;
            console.log(`Found ${numPostsOnPage} posts on ${pageUrl} for individual browsing.`);
            for (let i = 0; i < numPostsOnPage; i++) {
              if (!isRunning) {
                console.log('Operation stopped during individual post browsing.');
                break; 
              }
              if (postCount >= maxPosts) {
                isRunning = false;
                console.log('Reached maxPosts limit for browseOnly.');
                break; 
              }
              if (startTime && (Date.now() - startTime) >= maxTimeMinutes * 60 * 1000) {
                isRunning = false;
                console.log('Reached maxTimeMinutes limit for browseOnly.');
                break;
              }

              console.log(`Browsing post ${i + 1}/${numPostsOnPage} on ${pageUrl}. Total browsed: ${postCount}`);
              const browseResult = await chrome.tabs.sendMessage(tabId, {
                action: 'browseIndividualPost',
                postIndex: i,
                minTime: minTime, 
                maxTime: maxTime  
              });

              if (browseResult && browseResult.success) {
                postCount++; // 为每个成功浏览的独立帖子增加计数
                await updateStats();
              } else {
                console.warn(`Failed to browse post index ${i} on ${pageUrl}:`, browseResult ? browseResult.error : 'No response from content script');
              }
            }
          } else {
            console.log(`No posts found on ${pageUrl} for individual browsing, or error in getPostCount:`, postCountResponse);
          }
        } catch (e) {
          console.error('Error during browseOnly operations on ' + tab.url + ':', e);
        }
      }

      // 等待一段时间后返回主页
      await new Promise(resolve => setTimeout(resolve, 3000));
      await chrome.tabs.update(tab.id, { url: 'https://linux.do' });
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      console.error('Error:', error);
      await new Promise(resolve => setTimeout(resolve, 10000)); // 出错后等待较长时间
    }
  }
}