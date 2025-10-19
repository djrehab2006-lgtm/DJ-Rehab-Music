#!/usr/bin/env python3
"""
DJ Rehab Music Backend API Test Suite
Tests all authentication, folder, and track endpoints
"""

import requests
import json
import sys
from typing import Optional, Dict, Any

class DJRehabAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.token: Optional[str] = None
        self.headers: Dict[str, str] = {
            'Content-Type': 'application/json'
        }
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict[str, Any] = None, use_auth: bool = True) -> requests.Response:
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = self.headers.copy()
        
        if use_auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
            
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=data, timeout=10)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=headers, json=data, timeout=10)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise
    
    def test_health_check(self):
        """Test health endpoint"""
        try:
            response = self.make_request('GET', '/api/health', use_auth=False)
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'ok':
                    self.log_test("Health Check", True, "Backend is running")
                else:
                    self.log_test("Health Check", False, f"Unexpected response: {data}")
            else:
                self.log_test("Health Check", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
    
    def test_login(self):
        """Test login with default credentials"""
        try:
            login_data = {
                "username": "admin",
                "password": "admin123"
            }
            response = self.make_request('POST', '/api/auth/login', login_data, use_auth=False)
            
            if response.status_code == 200:
                data = response.json()
                if 'access_token' in data:
                    self.token = data['access_token']
                    self.log_test("Login", True, "Successfully obtained auth token")
                else:
                    self.log_test("Login", False, "No access_token in response")
            else:
                self.log_test("Login", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Login", False, f"Exception: {str(e)}")
    
    def test_verify_token(self):
        """Test token verification"""
        if not self.token:
            self.log_test("Token Verification", False, "No token available")
            return
            
        try:
            response = self.make_request('GET', '/api/auth/verify')
            if response.status_code == 200:
                data = response.json()
                if data.get('valid') and data.get('username') == 'admin':
                    self.log_test("Token Verification", True, "Token is valid")
                else:
                    self.log_test("Token Verification", False, f"Unexpected response: {data}")
            else:
                self.log_test("Token Verification", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Token Verification", False, f"Exception: {str(e)}")
    
    def test_create_folder(self):
        """Test creating a folder"""
        if not self.token:
            self.log_test("Create Folder", False, "No auth token")
            return None
            
        try:
            folder_data = {
                "name": "Electronic Beats",
                "cover_image": None
            }
            response = self.make_request('POST', '/api/folders', folder_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and data.get('name') == 'Electronic Beats':
                    self.log_test("Create Folder", True, f"Created folder with ID: {data['id']}")
                    return data['id']
                else:
                    self.log_test("Create Folder", False, f"Unexpected response: {data}")
            else:
                self.log_test("Create Folder", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Create Folder", False, f"Exception: {str(e)}")
        return None
    
    def test_get_folders(self):
        """Test getting all folders"""
        if not self.token:
            self.log_test("Get Folders", False, "No auth token")
            return
            
        try:
            response = self.make_request('GET', '/api/folders')
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Folders", True, f"Retrieved {len(data)} folders")
                else:
                    self.log_test("Get Folders", False, f"Expected list, got: {type(data)}")
            else:
                self.log_test("Get Folders", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Get Folders", False, f"Exception: {str(e)}")
    
    def test_create_track(self, folder_id: str):
        """Test creating a track"""
        if not self.token:
            self.log_test("Create Track", False, "No auth token")
            return None
            
        try:
            track_data = {
                "title": "Faded",
                "artist": "Alan Walker",
                "cdn_url": "https://cdn.example.com/faded.mp3",
                "duration": 210,
                "folder_id": folder_id,
                "cover_art": None
            }
            response = self.make_request('POST', '/api/tracks', track_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and data.get('title') == 'Faded':
                    self.log_test("Create Track", True, f"Created track with ID: {data['id']}")
                    return data['id']
                else:
                    self.log_test("Create Track", False, f"Unexpected response: {data}")
            else:
                self.log_test("Create Track", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Create Track", False, f"Exception: {str(e)}")
        return None
    
    def test_get_tracks(self, folder_id: str = None):
        """Test getting tracks"""
        if not self.token:
            self.log_test("Get Tracks", False, "No auth token")
            return
            
        try:
            endpoint = '/api/tracks'
            if folder_id:
                endpoint += f'?folder_id={folder_id}'
                
            response = self.make_request('GET', endpoint)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    filter_msg = f" (filtered by folder {folder_id})" if folder_id else ""
                    self.log_test("Get Tracks", True, f"Retrieved {len(data)} tracks{filter_msg}")
                else:
                    self.log_test("Get Tracks", False, f"Expected list, got: {type(data)}")
            else:
                self.log_test("Get Tracks", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Get Tracks", False, f"Exception: {str(e)}")
    
    def test_update_track(self, track_id: str):
        """Test updating a track"""
        if not self.token:
            self.log_test("Update Track", False, "No auth token")
            return
            
        try:
            update_data = {
                "title": "Faded (Remix)"
            }
            response = self.make_request('PUT', f'/api/tracks/{track_id}', update_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('title') == 'Faded (Remix)':
                    self.log_test("Update Track", True, "Successfully updated track title")
                else:
                    self.log_test("Update Track", False, f"Title not updated correctly: {data.get('title')}")
            else:
                self.log_test("Update Track", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Update Track", False, f"Exception: {str(e)}")
    
    def test_delete_track(self, track_id: str):
        """Test deleting a track"""
        if not self.token:
            self.log_test("Delete Track", False, "No auth token")
            return
            
        try:
            response = self.make_request('DELETE', f'/api/tracks/{track_id}')
            if response.status_code == 200:
                data = response.json()
                if 'message' in data:
                    self.log_test("Delete Track", True, "Successfully deleted track")
                else:
                    self.log_test("Delete Track", False, f"Unexpected response: {data}")
            else:
                self.log_test("Delete Track", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Delete Track", False, f"Exception: {str(e)}")
    
    def test_delete_folder(self, folder_id: str):
        """Test deleting a folder"""
        if not self.token:
            self.log_test("Delete Folder", False, "No auth token")
            return
            
        try:
            response = self.make_request('DELETE', f'/api/folders/{folder_id}')
            if response.status_code == 200:
                data = response.json()
                if 'message' in data:
                    self.log_test("Delete Folder", True, "Successfully deleted folder")
                else:
                    self.log_test("Delete Folder", False, f"Unexpected response: {data}")
            else:
                self.log_test("Delete Folder", False, f"Status code: {response.status_code}")
        except Exception as e:
            self.log_test("Delete Folder", False, f"Exception: {str(e)}")
    
    def run_full_test_suite(self):
        """Run the complete test suite as specified in the review request"""
        print("🎵 DJ Rehab Music Backend API Test Suite")
        print("=" * 50)
        
        # 1. Health check
        self.test_health_check()
        
        # 2. Login and get auth token
        self.test_login()
        
        # 3. Verify token
        self.test_verify_token()
        
        # 4. Create a folder called "Electronic Beats"
        folder_id = self.test_create_folder()
        
        # 5. Get all folders
        self.test_get_folders()
        
        # 6. Create a track with specified details
        track_id = None
        if folder_id:
            track_id = self.test_create_track(folder_id)
        
        # 7. Get all tracks
        self.test_get_tracks()
        
        # 8. Get tracks filtered by folder
        if folder_id:
            self.test_get_tracks(folder_id)
        
        # 9. Update the track title to "Faded (Remix)"
        if track_id:
            self.test_update_track(track_id)
        
        # 10. Delete the track
        if track_id:
            self.test_delete_track(track_id)
        
        # 11. Delete the folder
        if folder_id:
            self.test_delete_folder(folder_id)
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

def main():
    # Use the external backend URL from frontend .env
    backend_url = "https://music-streaming-app-4.preview.emergentagent.com"
    
    print(f"Testing backend at: {backend_url}")
    
    tester = DJRehabAPITester(backend_url)
    success = tester.run_full_test_suite()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()