document.addEventListener('DOMContentLoaded', function() {
  const startBrowseOnlyBtn = document.getElementById('startBrowseOnlyBtn');
  const browseOnlyPostsInput = document.getElementById('browseOnlyPosts');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDiv = document.getElementById('status');
  const minTimeInput = document.getElementById('minTime');
  const maxTimeInput = document.getElementById('maxTime');
  const maxPostsInput = document.getElementById('maxPosts');
  const maxTimeMinutesInput = document.getElementById('maxTimeMinutes');
  const postCountSpan = document.getElementById('postCount');
  const runningTimeSpan = document.getElementById('runningTime');

  // New elements for browse speed control
  const browseSpeedSelect = document.getElementById('browseSpeed');
  const customSpeedDiv = document.getElementById('customSpeedDiv');
  const customBrowseMinTimeInput = document.getElementById('customBrowseMinTime');
  const customBrowseMaxTimeInput = document.getElementById('customBrowseMaxTime');

  let currentMode = null; // 'autoLike' or 'browseOnly'

  // Event listener for browse speed selection
  browseSpeedSelect.addEventListener('change', function() {
    if (this.value === 'custom') {
      customSpeedDiv.style.display = 'block';
    } else {
      customSpeedDiv.style.display = 'none';
    }
  });

  // Initialize custom speed div visibility based on initial selection
  if (browseSpeedSelect.value === 'custom') {
    customSpeedDiv.style.display = 'block';
  } else {
    customSpeedDiv.style.display = 'none';
  }

  // 检查当前状态
  chrome.storage.local.get(['isRunning', 'minTime', 'maxTime', 'maxPosts', 'maxTimeMinutes', 'postCount', 'startTime', 'mode', 'browseOnlyPosts', 'browseSpeedValue', 'customBrowseMinTimeValue', 'customBrowseMaxTimeValue'], function(result) { // Added 'mode' and 'browseOnlyPosts'
    if (result.isRunning) {
      currentMode = result.mode || 'autoLike'; // Default to autoLike if mode is not set
      if (currentMode === 'autoLike') {
        statusDiv.textContent = '状态: 自动点赞运行中';
        startBtn.disabled = true;
        startBrowseOnlyBtn.disabled = true;
      } else if (currentMode === 'browseOnly') {
        statusDiv.textContent = '状态: 纯浏览运行中';
        startBrowseOnlyBtn.disabled = true;
        startBtn.disabled = true;
      }
      stopBtn.disabled = false;
    } else {
      statusDiv.textContent = '状态: 未开始';
      startBtn.disabled = false;
      startBrowseOnlyBtn.disabled = false;
      stopBtn.disabled = true;
    }
    
    // 恢复保存的设置
    if (result.minTime) minTimeInput.value = result.minTime;
    if (result.maxTime) maxTimeInput.value = result.maxTime;
    if (result.maxPosts) maxPostsInput.value = result.maxPosts;
    if (result.maxTimeMinutes) maxTimeMinutesInput.value = result.maxTimeMinutes;
    if (result.browseOnlyPosts) browseOnlyPostsInput.value = result.browseOnlyPosts; // Restore browse only posts
    if (result.postCount) postCountSpan.textContent = result.postCount;
    if (result.startTime) {
      const runningMinutes = Math.floor((Date.now() - result.startTime) / 60000);
      runningTimeSpan.textContent = runningMinutes;
    }

    // Restore browse speed UI state
    if (result.browseSpeedValue) {
      browseSpeedSelect.value = result.browseSpeedValue;
      if (result.browseSpeedValue === 'custom') {
        customSpeedDiv.style.display = 'block';
        if (result.customBrowseMinTimeValue) customBrowseMinTimeInput.value = result.customBrowseMinTimeValue;
        if (result.customBrowseMaxTimeValue) customBrowseMaxTimeInput.value = result.customBrowseMaxTimeValue;
      } else {
        customSpeedDiv.style.display = 'none';
      }
    } else {
      // Default UI state if nothing is stored (e.g., first run)
      if (browseSpeedSelect.value === 'custom') {
        customSpeedDiv.style.display = 'block';
      } else {
        customSpeedDiv.style.display = 'none';
      }
    }
  });

  // 定期更新运行时间
  setInterval(() => {
    chrome.storage.local.get(['startTime'], function(result) {
      if (result.startTime) {
        const runningMinutes = Math.floor((Date.now() - result.startTime) / 60000);
        runningTimeSpan.textContent = runningMinutes;
      }
    });
  }, 60000); // 每分钟更新一次

  startBtn.addEventListener('click', function() {
    const minTime = parseInt(minTimeInput.value);
    const maxTime = parseInt(maxTimeInput.value);
    const maxPosts = parseInt(maxPostsInput.value);
    const maxTimeMinutes = parseInt(maxTimeMinutesInput.value);
    
    // 验证输入
    if (minTime < 5 || maxTime < 5 || minTime > maxTime) {
      alert('请输入有效的时间范围（最小5秒，且最小值不能大于最大值）');
      return;
    }
    if (maxPosts < 1) {
      alert('请输入有效的帖子数量上限（最小1）');
      return;
    }
    if (maxTimeMinutes < 1) {
      alert('请输入有效的运行时间上限（最小1分钟）');
      return;
    }

    // 保存设置
    chrome.storage.local.set({ 
      isRunning: true,
      mode: 'autoLike', // Specify mode
      minTime: minTime,
      maxTime: maxTime,
      maxPosts: maxPosts,
      maxTimeMinutes: maxTimeMinutes,
      postCount: 0,
      startTime: Date.now()
    }, function() {
      statusDiv.textContent = '状态: 自动点赞运行中';
      startBtn.disabled = true;
      startBrowseOnlyBtn.disabled = true;
      stopBtn.disabled = false;
      postCountSpan.textContent = '0';
      runningTimeSpan.textContent = '0';
    });
    
    // 通知background script开始运行
    chrome.runtime.sendMessage({ 
      action: 'startOperation', // Generic action name
      mode: 'autoLike', // Specify mode
      minTime: minTime,
      maxTime: maxTime,
      maxPosts: maxPosts,
      maxTimeMinutes: maxTimeMinutes
    });
  });

  stopBtn.addEventListener('click', function() {
    chrome.storage.local.set({ 
      isRunning: false,
      startTime: null
    }, function() {
      statusDiv.textContent = '状态: 已停止';
      startBtn.disabled = false;
      startBrowseOnlyBtn.disabled = false;
      stopBtn.disabled = true;
      currentMode = null;
    });
    
    // 通知background script停止运行
    chrome.runtime.sendMessage({ action: 'stopOperation' }); // Generic stop action
  });

  startBrowseOnlyBtn.addEventListener('click', function() {
    // const minTime = parseInt(minTimeInput.value); // No longer use general minTime for browseOnly
    // const maxTime = parseInt(maxTimeInput.value); // No longer use general maxTime for browseOnly
    const browseOnlyPosts = parseInt(browseOnlyPostsInput.value);
    const maxTimeMinutes = parseInt(maxTimeMinutesInput.value); // get maxTimeMinutes for consistency

    let browseMinTime, browseMaxTime;
    const selectedSpeed = browseSpeedSelect.value;

    if (selectedSpeed === 'fast') {
      browseMinTime = 1; // Approx 5.25s per post (1-2s per scroll segment, 3.5 scroll segments avg)
      browseMaxTime = 2;
    } else if (selectedSpeed === 'medium') {
      browseMinTime = 2; // Approx 10.5s per post (2-4s per scroll segment, 3.5 scroll segments avg)
      browseMaxTime = 4;
    } else if (selectedSpeed === 'slow') {
      browseMinTime = 4; // Approx 15.75s per post (4-5s per scroll segment, 3.5 scroll segments avg)
      browseMaxTime = 5;
    } else if (selectedSpeed === 'custom') {
      browseMinTime = parseInt(customBrowseMinTimeInput.value);
      browseMaxTime = parseInt(customBrowseMaxTimeInput.value);
      if (isNaN(browseMinTime) || isNaN(browseMaxTime) || browseMinTime < 1 || browseMaxTime < 1 || browseMinTime > browseMaxTime) {
        alert('请输入有效的自定义时间范围（最小1秒，且最小值不能大于最大值）');
        return;
      }
    } else { // Default to medium if something goes wrong
      browseMinTime = 2;
      browseMaxTime = 3;
    }

    if (browseOnlyPosts < 1) {
      alert('请输入有效的纯浏览帖子数量（最小1）');
      return;
    }
    // Validation for minTime and maxTime (general ones) was here, now specific to browseMinTime/MaxTime for custom
    // if (minTime < 5 || maxTime < 5 || minTime > maxTime) { 
    //   alert('请输入有效的时间范围（最小5秒，且最小值不能大于最大值）');
    //   return;
    // }
    if (maxTimeMinutes < 1) {
      alert('请输入有效的运行时间上限（最小1分钟）');
      return;
    }

    // 保存设置
    chrome.storage.local.set({
      isRunning: true,
      mode: 'browseOnly',
      minTime: browseMinTime, // Save specific browseMinTime for this mode
      maxTime: browseMaxTime, // Save specific browseMaxTime for this mode
      browseOnlyPosts: browseOnlyPosts,
      maxTimeMinutes: maxTimeMinutes, // Save maxTimeMinutes for browse only mode
      postCount: 0,
      startTime: Date.now(),
      // Store UI state for speed selection
      browseSpeedValue: selectedSpeed,
      customBrowseMinTimeValue: selectedSpeed === 'custom' ? browseMinTime : customBrowseMinTimeInput.value, 
      customBrowseMaxTimeValue: selectedSpeed === 'custom' ? browseMaxTime : customBrowseMaxTimeInput.value
    }, function() {
      statusDiv.textContent = '状态: 纯浏览运行中';
      startBrowseOnlyBtn.disabled = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      postCountSpan.textContent = '0';
      runningTimeSpan.textContent = '0';
    });

    // 通知background script开始纯浏览
    chrome.runtime.sendMessage({
      action: 'startOperation',
      mode: 'browseOnly',
      minTime: browseMinTime, // Pass specific browseMinTime
      maxTime: browseMaxTime, // Pass specific browseMaxTime
      browseOnlyPosts: browseOnlyPosts,
      maxTimeMinutes: maxTimeMinutes // Pass maxTimeMinutes
    });
  });


  // 监听来自background script的更新
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateStats') {
      if (message.postCount !== undefined) {
        postCountSpan.textContent = message.postCount;
      }
      if (message.runningTime !== undefined) {
        runningTimeSpan.textContent = message.runningTime;
      }
    }
  });
});