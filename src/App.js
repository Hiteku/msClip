import React, { useState, useEffect } from 'react';
import Dropzone from 'react-dropzone';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import './styles.css';

var diff = 261

const processImageA = async (file) => {
  const image = new Image();
  image.src = URL.createObjectURL(file);

  return new Promise((resolve) => {
    // 定義內部函式，用於處理圖片 A
    const loadImage = () => {
      // 創建兩個 Canvas 元素，一個用於原圖，一個用於灰階影像的處理
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = image.width;
      colorCanvas.height = image.height;
      const ctxColor = colorCanvas.getContext('2d');
      ctxColor.drawImage(image, 0, 0);

      const grayscaleCanvas = document.createElement('canvas');
      grayscaleCanvas.width = image.width;
      grayscaleCanvas.height = image.height;
      const ctxGrayscale = grayscaleCanvas.getContext('2d');
      ctxGrayscale.drawImage(image, 0, 0);

      // 取得圖片的像素數據
      const imageData = ctxGrayscale.getImageData(0, 0, grayscaleCanvas.width, grayscaleCanvas.height);
      const data = imageData.data;

      // 影像處理：將圖片轉換為灰階
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg;
        data[i + 1] = avg;
        data[i + 2] = avg;
      }
      ctxGrayscale.putImageData(imageData, 0, 0);

      // 影像處理：找到且保留像素面積大於的過深黑色區域的座標
      var darkAreaCoordinates = [];
      const visited = new Set();
      const directions = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];

      const isDarkPixel = (pixelValue) => pixelValue < 30;

      const processDarkArea = (x, y) => {
        const stack = [[x, y]];
        const currentArea = [];

        while (stack.length) {
          const [currentX, currentY] = stack.pop();
          const index = (currentY * colorCanvas.width + currentX) * 4;

          if (
            currentX >= 0 &&
            currentY >= 0 &&
            currentX < colorCanvas.width &&
            currentY < colorCanvas.height &&
            !visited.has(index) &&
            isDarkPixel(data[index])
          ) {
            visited.add(index);
            currentArea.push({ x: currentX, y: currentY });

            for (const [dx, dy] of directions) {
              stack.push([currentX + dx, currentY + dy]);
            }
          }
        }

        return currentArea;
      };

      let largestArea = [];
      let secondLargestArea = [];
      let foundOneArea = false;

      for (let y = 0; y < colorCanvas.height; y++) {
        for (let x = 0; x < colorCanvas.width; x++) {
          const index = (y * colorCanvas.width + x) * 4;
          const pixelValue = data[index];

          if (!visited.has(index) && isDarkPixel(pixelValue)) {
            const currentArea = processDarkArea(x, y);

            if (currentArea.length > 4500) {
              if (!foundOneArea) {
                // 如果還沒找到區域，將當前區域設為最大區域
                largestArea = currentArea;
                foundOneArea = true;
              } else if (currentArea.length > largestArea.length) {
                // 如果已經找到區域，但當前區域比最大區域還大，則將最大區域設為當前區域，
                // 同時將之前找到的第二大區域更新為最大區域
                secondLargestArea = largestArea;
                largestArea = currentArea;
              } else if (currentArea.length > secondLargestArea.length) {
                // 如果已經找到區域，且當前區域不如最大區域大但比第二大區域大，則將當前區域設為第二大區域
                secondLargestArea = currentArea;
              }
            }

            // 標記已訪問的像素點
            currentArea.forEach(coord => visited.add(coord.index));
          }
        }
      }

      if (secondLargestArea.length > 0 && secondLargestArea.length > largestArea.length/2.5)
        // 如果找到兩個區域且面積沒差很多，則選擇x值較小的那個區域作為最終結果
        darkAreaCoordinates = (largestArea[0].x < secondLargestArea[0].x) ? largestArea : secondLargestArea;
      else darkAreaCoordinates = largestArea; // 如果只找到一個區域，則該區域為最終結果

      // 影像處理：根據保留的座標進行剪裁
      const croppedCanvas = document.createElement('canvas');
      let minX = Math.min(...darkAreaCoordinates.map((coord) => coord.x))-5;
      const maxX = Math.max(...darkAreaCoordinates.map((coord) => coord.x));
      let minY = Math.min(...darkAreaCoordinates.map((coord) => coord.y));
      const maxY = Math.max(...darkAreaCoordinates.map((coord) => coord.y));
      let croppedWidth = maxX - minX + 1;
      let croppedHeight = maxY - minY + 1;

      if (croppedWidth < diff) minX -= 2;
      else minX += 2;

      croppedWidth = diff+5;
      if (croppedHeight > diff * 2) {
        croppedHeight = image.height;
        minY = 0;
      } else {
        croppedHeight += 11;
        minY -= 9;
      }

      croppedCanvas.width = croppedWidth;
      croppedCanvas.height = croppedHeight;
      const ctxCropped = croppedCanvas.getContext('2d');

      // 在剪裁Canvas上繪製原圖的剪裁區域
      ctxCropped.drawImage(
        colorCanvas,
        minX,
        minY,
        croppedWidth,
        croppedHeight,
        0,
        0,
        croppedWidth,
        croppedHeight
      );

      image.onload = null;

      // // 處理後的影像資料URL
      // const processedImageDataURL = croppedCanvas.toDataURL('image/png');

      // 處理後的圖片輸出成 Blob 物件
      croppedCanvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg');
    };

    // 使用 onload 事件來確保圖片載入完成後再進行處理
    image.onload = () => {
      loadImage();
    };
  });
};

const processImageB = async (file) => {
  const image = new Image();
  image.src = URL.createObjectURL(file);

  return new Promise((resolve) => {
    // 定義內部函式，用於處理圖片 B
    const loadImage = () => {
      // 創建一個 Canvas 元素，並取得 2D 繪圖上下文
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 調整 canvas 的尺寸為圖片尺寸
      canvas.width = image.width;
      canvas.height = image.height;
      // window.alert('B: ' + image.width + ' ' + image.height);

      // 繪製圖片到 canvas 上
      ctx.drawImage(image, 0, 0);

      // 取得圖片的像素數據
      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      const data = imageData.data;

      // 初始化最大和第二大顏色差異及其對應的分隔線位置
      let hMaxColorDiff = 0;
      let hSecondMaxColorDiff = 0;
      let hSeparationLineYMax = 0;
      let hSeparationLineYSecondMax = 0;

      // 遍歷圖片的每一行像素
      for (let y = 1; y < image.height; y++) {
        let colorDiff = 0;

        for (let x = 0; x < image.width; x++) {
          // 取得目前像素在數據陣列中的索引
          const index = (y * image.width + x) * 4;
          const prevIndex = ((y - 1) * image.width + x) * 4;

          // 計算目前像素與上一行像素的顏色差異
          colorDiff += Math.abs(data[index] - data[prevIndex]);
          colorDiff += Math.abs(data[index + 1] - data[prevIndex + 1]);
          colorDiff += Math.abs(data[index + 2] - data[prevIndex + 2]);
        }

        // 更新最大和第二大顏色差異及其對應的分隔線位置
        if (colorDiff > hMaxColorDiff) {
          hSecondMaxColorDiff = hMaxColorDiff;
          hSeparationLineYSecondMax = hSeparationLineYMax;

          hMaxColorDiff = colorDiff;
          hSeparationLineYMax = y;
        } else if (colorDiff > hSecondMaxColorDiff) {
          hSecondMaxColorDiff = colorDiff;
          hSeparationLineYSecondMax = y;
        }
      }

      let h1 = hSeparationLineYSecondMax;
      let h2 = hSeparationLineYMax - hSeparationLineYSecondMax;
      if (h2 < h1) { h1+=1; h2-=3 } else { h1-=1; h2+=3 }
      if (Math.abs(h2) < 10 || (600 < Math.abs(h2) && Math.abs(h2) < 625)) { h1 = 0; h2 = image.height }

      // 初始化最大和第二大顏色差異及其對應的分隔線位置
      let wMaxColorDiff = 0;
      let wSecondMaxColorDiff = 0;
      let wSeparationLineXMax = 0;
      let wSeparationLineXSecondMax = 0;

      // 遍歷圖片的每一列像素
      for (let x = 1; x < image.width; x++) {
        let colorDiff = 0;

        for (let y = 0; y < image.height; y++) {
          // 取得目前像素在數據陣列中的索引
          const index = (y * image.width + x) * 4;
          const prevIndex = (y * image.width + x - 1) * 4;

          // 計算目前像素與前一列像素的顏色差異
          colorDiff += Math.abs(data[index] - data[prevIndex]);
          colorDiff += Math.abs(data[index + 1] - data[prevIndex + 1]);
          colorDiff += Math.abs(data[index + 2] - data[prevIndex + 2]);
        }

        // 更新最大和第二大顏色差異及其對應的分隔線位置
        if (colorDiff > wMaxColorDiff) {
          wSecondMaxColorDiff = wMaxColorDiff;
          wSeparationLineXSecondMax = wSeparationLineXMax;

          wMaxColorDiff = colorDiff;
          wSeparationLineXMax = x;
        } else if (colorDiff > wSecondMaxColorDiff) {
          wSecondMaxColorDiff = colorDiff;
          wSeparationLineXSecondMax = x;
        }
      }

      let w1 = wSeparationLineXSecondMax;
      let w2 = wSeparationLineXMax - wSeparationLineXSecondMax;
      w2 = diff-2
      if (w2 < w1) { w1+=1; w2*=-1 } else w1-=1;
      if (Math.abs(w2) < 10) w1 = 0;

      // 裁切圖片，保留兩個分隔線之間的部分
      const croppedImageData = ctx.getImageData(w1, h1, w2, h2);

      // 設定 canvas 尺寸為裁切後的圖片尺寸
      canvas.width = croppedImageData.width;
      canvas.height = croppedImageData.height;

      // 繪製裁切後的圖片到 canvas 上
      ctx.putImageData(croppedImageData, 0, 0);

      // 處理後的圖片輸出成 Blob 物件
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg');
    };

    // 使用 onload 事件來確保圖片載入完成後再進行處理
    image.onload = () => {
      loadImage();
    };
  });
};

const App = () => {
  const [images, setImages] = useState([]);
  // const [activePage, setActivePage] = useState('imageProcessing');
  const [ori, setOri] = useState(null);
  const [resultA, setResultA] = useState(null);
  const [resultB, setResultB] = useState(null);
  const [isProcessed, setIsProcessed] = useState(false); // 新增 isProcessed 狀態
  const [numFilesUploaded, setNumFilesUploaded] = useState(0); // 新增狀態變數來追蹤已上傳的檔案數量
  const [processing, setProcessing] = useState(false); // 新增處理中的狀態變數

  const handleImageDrop = (acceptedFiles) => {
    setImages([]);
    setNumFilesUploaded(acceptedFiles.length);
    setOri(null)
    setResultA(null)
    setResultB(null)
    setIsProcessed(false)

    // 將每個檔案表示為一個物件，包含name和file屬性
    const updatedImages = acceptedFiles.map((file) => ({
      name: file.name,
      file: file,
    }));
  
    setImages([...images, ...updatedImages]);
  };

  const handleProcessImages = async () => {
    setImages([]); // 清空 images 狀態
    setIsProcessed(false);
    setProcessing(true);
    if (images.length > 0) {
      setIsProcessed(false);
      const zip = new JSZip();

      const resultUrlsA = [];
      const resultBlobsB = [];
      const oriUrls = [];

      for (const image of images) {
        const imageA = await processImageA(image.file);
        const imageB = await processImageB(imageA);

        // zip.file(`${image.name}-A.jpg`, imageA);
        zip.file(`${image.name}_clip.jpg`, imageB);

        resultUrlsA.push(URL.createObjectURL(imageA));
        resultBlobsB.push(imageB);
        oriUrls.push(image.file);
      }

      setOri(oriUrls);
      setResultA(resultUrlsA);
      setResultB(resultBlobsB);
      setIsProcessed(true);
      setProcessing(false);
    }
  };

  useEffect(() => {
    // 組件卸載時釋放 URL
    return () => {
      if (ori) {
        ori.forEach((url) => URL.revokeObjectURL(url));
      }
      if (resultA) {
        resultA.forEach((url) => URL.revokeObjectURL(url));
      }
      if (resultB) {
        resultB.forEach((blob) => URL.revokeObjectURL(URL.createObjectURL(blob)));
      }
    };
  }, [ori, resultA, resultB]);

  const handleDownload = () => {
    if (isProcessed && resultB) {
      const zip = new JSZip();

      for (let i = 0; i < ori.length; i++)
        zip.file(`clip_${ori[i].name}`, resultB[i]);

      zip.generateAsync({ type: 'blob' }).then((content) => {
        saveAs(content, 'processed_images.zip');
      });
    }
  };
  /*
  const switchToHelloPage = () => {
    setActivePage('hello');
  };

  const switchToImageProcessingPage = () => {
    setActivePage('imageProcessing');
  };
  */
  return (
    <div className="App">
      <h1>裝備裁剪</h1>
      <div className="page">
        {/*<button onClick={switchToHelloPage}>首頁</button>
        <button onClick={switchToImageProcessingPage}>裝備裁剪</button>*/}
        {/*activePage === 'hello' && (
          <div>
            <p>Hello World!</p>
          </div>
        )*/}
        {/*activePage === 'imageProcessing' && */(
          <div>
            <Dropzone onDrop={handleImageDrop} accept="image/*" multiple>
              {({ getRootProps, getInputProps }) => (
                <div {...getRootProps()} className="dropzone">
                  <input {...getInputProps()} />
                  <p>拖曳截圖至此，或點擊選擇截圖上傳。</p>
                </div>
              )}
            </Dropzone>
            <button onClick={handleProcessImages}>執行</button>
            {isProcessed && (
                <button onClick={handleDownload}>下載已裁剪的圖片</button>
            )}
            {images.length > 0 && <p>已選擇 {numFilesUploaded} 個檔案上傳成功</p>}
            {processing && (<div className="loading-container"><div className="loading-spinner" /></div>)}
            {!processing && images.length === 0 && <p>請使用 MapleStory 內建截圖（明亮背景）</p>}
            {resultB &&
              ori.map((file, index) => (
                <div className="image-wrapper" key={index}>
                  <div className="image-container" style={{ width: "50%" }}>
                    <h3>圖 {index + 1}：{file.name}</h3>
                    <img src={URL.createObjectURL(file)} alt={`Processed B ${index + 1}`} />
                  </div>
                  <div className="image-container">
                    <img src={URL.createObjectURL(resultB[index])} alt={`Processed B ${index + 1}`} />
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
