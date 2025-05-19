// 监听来自background script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'likePost') {
    // 查找所有未点赞的按钮
    const likeButtons = document.querySelectorAll('.discourse-reactions-reaction-button button.btn-toggle-reaction-like');
    if (likeButtons.length > 0) {
      // 点击第一个未点赞的按钮
      likeButtons[0].click();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
    return true; // 保持消息通道开放
  } else if (message.action === 'likeComments') {
    // 随机点赞评论
    const commentLikeButtons = document.querySelectorAll('.topic-post .discourse-reactions-reaction-button button.btn-toggle-reaction-like');
    if (commentLikeButtons.length > 0) {
      // 随机选择1-3个评论点赞
      const numToLike = Math.floor(Math.random() * 3) + 1;
      const shuffledButtons = Array.from(commentLikeButtons).sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(numToLike, shuffledButtons.length); i++) {
        shuffledButtons[i].click();
      }
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
    return true;
  } else if (message.action === 'browsePage') {
    // 执行页面浏览操作
    browsePage(message.minTime, message.maxTime).then(() => {
      sendResponse({ success: true });
    });
    return true; // 保持消息通道开放
  } else if (message.action === 'getPostCount') {
    const posts = getPostElements();
    sendResponse({ count: posts.length });
    return true;
  } else if (message.action === 'browseIndividualPost') {
    browseIndividualPost(message.postIndex, message.minTime, message.maxTime)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true;
  }
});

// 获取所有帖子元素
function getPostElements() {
  // 选择所有帖子，包括主楼和回复
  return document.querySelectorAll('article[data-post-id]');
}

// 浏览单个帖子
async function browseIndividualPost(postIndex, minTime, maxTime) {
  const posts = getPostElements();
  if (postIndex >= 0 && postIndex < posts.length) {
    const postElement = posts[postIndex];
    
    // 将帖子滚动到视野中央
    postElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });

    // 等待滚动动画完成 (给一个固定的短暂延时，或者更复杂地监听scrollend事件)
    await new Promise(resolve => setTimeout(resolve, 700)); // 0.7秒等待滚动

    // 随机等待一段时间
    const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

    // 随机鼠标移动（模拟真实用户行为，限制在帖子元素内）
    const rect = postElement.getBoundingClientRect();
    const randomX = Math.floor(Math.random() * rect.width) + rect.left;
    const randomY = Math.floor(Math.random() * rect.height) + rect.top;
    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: randomX,
      clientY: randomY,
      view: window
    });
    // 尝试将事件分派给更具体的元素，如果帖子元素本身不接收鼠标事件
    // document.dispatchEvent(mouseMoveEvent); // 或者 postElement.dispatchEvent(mouseMoveEvent);
    // 通常 document.dispatchEvent 是可以的
    document.dispatchEvent(mouseMoveEvent);

    return { success: true };
  } else {
    return { success: false, error: 'Post index out of bounds or no posts found' };
  }
}

// 页面浏览函数
async function browsePage(minTime, maxTime) {
  // 随机生成2-3个滚动位置
  const numPositions = Math.floor(Math.random() * 2) + 2; // 2-3个位置
  const positions = [];
  
  // 生成随机位置
  for (let i = 0; i < numPositions; i++) {
    positions.push(Math.random() * 0.6 + 0.2); // 20%-80%之间
  }
  
  // 对位置进行排序
  positions.sort((a, b) => a - b);
  
  // 添加起始位置
  positions.unshift(0);
  
  for (let i = 0; i < positions.length; i++) {
    const position = positions[i];
    
    // 滚动到指定位置
    window.scrollTo({
      top: document.body.scrollHeight * position,
      behavior: 'smooth'
    });
    
    // 随机等待一段时间（缩短等待时间）
    const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    
    // 随机鼠标移动（模拟真实用户行为）
    const randomX = Math.floor(Math.random() * window.innerWidth);
    const randomY = Math.floor(Math.random() * window.innerHeight);
    const mouseMoveEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: randomX,
      clientY: randomY
    });
    document.dispatchEvent(mouseMoveEvent);
  }
  
  // 最后回到顶部
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// 添加点赞按钮的样式
const style = document.createElement('style');
style.textContent = `
  .discourse-reactions-reaction-button {
    cursor: pointer;
    padding: 5px 10px;
    border-radius: 4px;
    background-color: #f0f0f0;
    border: 1px solid #ddd;
  }
  .discourse-reactions-reaction-button.has-reacted {
    background-color: #4CAF50;
    color: white;
  }
  .discourse-reactions-reaction-button:hover {
    background-color: #e0e0e0;
  }
  .discourse-reactions-reaction-button.has-reacted:hover {
    background-color: #45a049;
  }
`;
document.head.appendChild(style);