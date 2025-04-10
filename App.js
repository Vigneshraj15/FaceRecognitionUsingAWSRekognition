import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [image, setImage] = useState(null);
  const [uploadResultMessage, setUploadResultMessage] = useState('Please upload an image to authenticate.');
  const [visitorName, setVisitorName] = useState('placeholder.png');
  const [isAuth, setAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authHistory, setAuthHistory] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  
  const videoRef = useRef(null);

  // Open Camera
  useEffect(() => {
    const enableCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };
    if (cameraOpen) enableCamera();
    else if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  }, [cameraOpen]);

  // Capture Image from Camera
  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      const dataURL = canvas.toDataURL('image/jpeg');
      setImage(dataURL); // Store captured image as base64
      setCameraOpen(false); // Close camera after capture
    }
  };

  // Handle File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) setImage(file);
  };

  // Upload and Authenticate Image
  const sendImage = async (e) => {
    e.preventDefault();
    if (!image) {
      setUploadResultMessage('Please select an image before authenticating.');
      return;
    }

    setIsLoading(true);
    const visitorImageName = uuidv4();
    let imageToUpload = image;

    if (typeof image === 'string') {
      // If the image is base64 (from camera), convert it to Blob
      const byteCharacters = atob(image.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length).fill(null).map((_, i) => byteCharacters.charCodeAt(i));
      const byteArray = new Uint8Array(byteNumbers);
      imageToUpload = new Blob([byteArray], { type: 'image/jpeg' });
    }

    try {
      // Upload Image to S3
      const uploadUrl = `https://h3yf9kq1wl.execute-api.ap-south-1.amazonaws.com/dev2/vicky-visitor-image-storage/${visitorImageName}.jpeg`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: imageToUpload
      });

      if (!uploadResponse.ok) throw new Error(`Image upload failed: ${uploadResponse.statusText}`);

      // Authenticate Visitor
      const response = await authenticate(visitorImageName);
      const timestamp = new Date().toLocaleString();

      if (response.Message === 'Success') {
        setAuth(true);
        setUploadResultMessage(`Hi ${response.firstName} ${response.lastName}, Welcome! Have a Nice Day!`);
        setAuthHistory(prev => [...prev, { visitorName: `${response.firstName} ${response.lastName}`, status: 'Success', timestamp }]);
      } else {
        setAuth(false);
        setUploadResultMessage('Authentication Failed: This person is not an employee.');
      }
    } catch (error) {
      setAuth(false);
      setUploadResultMessage('Error during authentication. Please try again.');
      console.error('Error in sendImage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Authenticate Image via API
  const authenticate = async (visitorImageName) => {
    const requestUrl = `https://h3yf9kq1wl.execute-api.ap-south-1.amazonaws.com/dev2/employee?objectKey=${visitorImageName}.jpeg`;
    try {
      const response = await fetch(requestUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      return response.json();
    } catch (error) {
      console.error('Error in authentication:', error);
      return { Message: 'Error' };
    }
  };

  // Export Authentication History to Excel
  const exportToExcel = () => {
    const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
    const ws = XLSX.utils.json_to_sheet(authHistory);
    const wb = { Sheets: { data: ws }, SheetNames: ['data'] };
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    const data = new Blob([excelBuffer], { type: fileType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(data);
    link.download = 'auth_history.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="App">
      <h2>FACIAL RECOGNITION SYSTEM</h2>

      {/* Camera Capture */}
      <button onClick={() => setCameraOpen(prev => !prev)}>
        {cameraOpen ? 'Close Camera' : 'Open Camera'}
      </button>
      {cameraOpen && (
        <div className="camera">
          <video ref={videoRef} autoPlay />
          <button onClick={captureImage}>Capture</button>
        </div>
      )}

      {/* File Upload & Authentication */}
      <form onSubmit={sendImage}>
        <input type="file" accept="image/*" onChange={handleFileUpload} />
        <button type="submit">Authenticate</button>
      </form>

      {/* Display Image */}
      {image && (
        <div className="preview">
          <img src={typeof image === 'string' ? image : URL.createObjectURL(image)} alt="Captured" height={250} width={250} />
        </div>
      )}

      {/* Authentication Result */}
      {isLoading ? <div className="loading">Loading...</div> : <div className={isAuth ? 'success' : 'failure'}>{uploadResultMessage}</div>}

      {/* Export to Excel */}
      <button onClick={exportToExcel}>Download as Excel</button>

      {/* Authentication History Table */}
      <table className="auth-history">
        <thead>
          <tr>
            <th>Visitor Name</th>
            <th>Status</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {authHistory.map((attempt, index) => (
            <tr key={index}>
              <td>{attempt.visitorName}</td>
              <td>{attempt.status}</td>
              <td>{attempt.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
