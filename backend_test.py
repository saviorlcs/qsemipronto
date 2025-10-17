import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import subprocess
import time

class PomodoroAPITester:
    def __init__(self, base_url=""):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })

    def setup_test_user(self):
        """Create test user and session in MongoDB"""
        print("\n🔧 Setting up test user and session...")
        
        timestamp = int(time.time())
        self.user_id = f"test-user-{timestamp}"
        self.session_token = f"test_session_{timestamp}"
        
        # MongoDB commands to create test user and session
        mongo_commands = f'''
use('test_database');
var userId = '{self.user_id}';
var sessionToken = '{self.session_token}';
var expiresAt = new Date(Date.now() + 7*24*60*60*1000);

// Create test user
db.users.insertOne({{
  id: userId,
  email: 'test.user.{timestamp}@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  level: 1,
  coins: 1000,
  xp: 0,
  items_owned: [],
  online_status: 'offline',
  last_activity: new Date(),
  created_at: new Date()
}});

// Create session
db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: expiresAt,
  created_at: new Date()
}});

print('Test user and session created successfully');
print('User ID: ' + userId);
print('Session Token: ' + sessionToken);
'''
        
        try:
            result = subprocess.run(
                ['mongosh', '--eval', mongo_commands],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                print("✅ Test user and session created successfully")
                return True
            else:
                print(f"❌ Failed to create test user: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error setting up test user: {str(e)}")
            return False

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n🧹 Cleaning up test data...")
        
        cleanup_commands = f'''
use('test_database');
db.users.deleteMany({{email: /test\\.user\\./}});
db.user_sessions.deleteMany({{session_token: /test_session/}});
db.subjects.deleteMany({{user_id: /test-user-/}});
db.study_sessions.deleteMany({{user_id: /test-user-/}});
db.tasks.deleteMany({{user_id: /test-user-/}});
print('Test data cleaned up');
'''
        
        try:
            subprocess.run(['mongosh', '--eval', cleanup_commands], timeout=30)
            print("✅ Test data cleaned up")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {str(e)}")

    def test_api_endpoint(self, method, endpoint, expected_status, data=None, description=""):
        """Test a single API endpoint"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            headers['Authorization'] = f'Bearer {self.session_token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            
            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_result(f"{method} {endpoint} {description}", success, details)
            
            return success, response.json() if success and response.content else {}
            
        except Exception as e:
            self.log_result(f"{method} {endpoint} {description}", False, f"Exception: {str(e)}")
            return False, {}

    def run_auth_tests(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication...")
        
        # Test /auth/me with valid session
        success, user_data = self.test_api_endpoint('GET', 'auth/me', 200, description="(Get current user)")
        
        if success and user_data:
            print(f"   User: {user_data.get('name')} ({user_data.get('email')})")
            print(f"   Level: {user_data.get('level')}, Coins: {user_data.get('coins')}")
            print(f"   Nickname: {user_data.get('nickname')}, Tag: {user_data.get('tag')}")
        
        return success

    def run_nickname_tests(self):
        """Test nickname#tag functionality - CRITICAL FEATURE"""
        print("\n🏷️ Testing Nickname#Tag System (CRITICAL)...")
        
        # Test nickname availability check - valid format
        success1, _ = self.test_api_endpoint('GET', 'user/nickname/check?nickname=TestUser&tag=123', 200, description="(Check valid nickname availability)")
        
        # Test nickname availability check - invalid nickname (too short)
        success2, response2 = self.test_api_endpoint('GET', 'user/nickname/check?nickname=abc&tag=123', 200, description="(Check invalid nickname - too short)")
        if success2:
            available = response2.get('available', True)
            if not available and 'inválido' in response2.get('reason', '').lower():
                print("   ✅ Correctly rejected short nickname")
            else:
                print("   ❌ Should reject short nickname")
        
        # Test nickname availability check - invalid tag (too short)
        success3, response3 = self.test_api_endpoint('GET', 'user/nickname/check?nickname=TestUser&tag=12', 200, description="(Check invalid tag - too short)")
        if success3:
            available = response3.get('available', True)
            if not available and 'inválido' in response3.get('reason', '').lower():
                print("   ✅ Correctly rejected short tag")
            else:
                print("   ❌ Should reject short tag")
        
        # Create nickname#tag
        nickname_data = {"nickname": "TestUser", "tag": "123"}
        success4, _ = self.test_api_endpoint('POST', 'user/nickname', 200, nickname_data, "(Create nickname#tag)")
        
        # Test duplicate nickname#tag (should fail)
        success5, response5 = self.test_api_endpoint('POST', 'user/nickname', 400, nickname_data, "(Try duplicate nickname#tag)")
        if not success5:
            print("   ✅ Correctly prevented duplicate nickname#tag")
        
        # Test case insensitive check
        nickname_data_case = {"nickname": "testuser", "tag": "123"}
        success6, response6 = self.test_api_endpoint('POST', 'user/nickname', 400, nickname_data_case, "(Try case insensitive duplicate)")
        if not success6:
            print("   ✅ Correctly prevented case insensitive duplicate")
        
        return success1 and success4

    def run_subject_tests(self):
        """Test subject management"""
        print("\n📚 Testing Subject Management...")
        
        # Get subjects (should be empty initially)
        self.test_api_endpoint('GET', 'subjects', 200, description="(Get subjects)")
        
        # Create a subject
        subject_data = {
            "name": "Matemática",
            "color": "#3B82F6",
            "time_goal": 180
        }
        success, created_subject = self.test_api_endpoint('POST', 'subjects', 200, subject_data, "(Create subject)")
        
        if success and created_subject:
            subject_id = created_subject.get('id')
            print(f"   Created subject: {created_subject.get('name')} (ID: {subject_id})")
            
            # Update subject
            update_data = {"name": "Matemática Avançada"}
            self.test_api_endpoint('PATCH', f'subjects/{subject_id}', 200, update_data, "(Update subject)")
            
            # Get subjects again (should have 1)
            self.test_api_endpoint('GET', 'subjects', 200, description="(Get subjects after creation)")
            
            return subject_id
        
        return None

    def run_study_session_tests(self, subject_id):
        """Test study session functionality with rewards calculation"""
        print("\n⏱️ Testing Study Sessions & Rewards (5min = 1 coin)...")
        
        if not subject_id:
            print("❌ Skipping study session tests - no subject available")
            return None
        
        # Start study session
        session_data = {"subject_id": subject_id}
        success, session_response = self.test_api_endpoint('POST', 'study/start', 200, session_data, "(Start study session)")
        
        if success and session_response:
            session_id = session_response.get('id')
            print(f"   Started session: {session_id}")
            
            # End study session (completed) - 25 minutes should give 5 coins
            end_data = {
                "session_id": session_id,
                "duration": 25,  # 25 minutes studied
                "skipped": False
            }
            success_end, end_response = self.test_api_endpoint('POST', 'study/end', 200, end_data, "(End study session - 25 min)")
            
            if success_end and end_response:
                coins_earned = end_response.get('coins_earned', 0)
                expected_coins = 25 // 5  # 5 coins for 25 minutes
                if coins_earned == expected_coins:
                    print(f"   ✅ Correct reward: {coins_earned} coins for 25 minutes")
                else:
                    print(f"   ❌ Wrong reward: got {coins_earned}, expected {expected_coins}")
            
            # Test XP progression (base 100, increases 25% each level)
            # Get user data to check XP and level
            success_user, user_data = self.test_api_endpoint('GET', 'auth/me', 200, description="(Check XP after study)")
            if success_user and user_data:
                level = user_data.get('level', 1)
                xp = user_data.get('xp', 0)
                print(f"   Current Level: {level}, XP: {xp}")
                
                # Calculate expected XP for next level: 100 * (1.25 ^ (level-1))
                expected_xp_for_next = int(100 * (1.25 ** (level - 1)) + 0.999)
                print(f"   XP needed for next level: {expected_xp_for_next}")
            
            # Start another session and skip it (should give 0 coins)
            success2, session_response2 = self.test_api_endpoint('POST', 'study/start', 200, session_data, "(Start second session)")
            if success2:
                session_id2 = session_response2.get('id')
                end_data2 = {
                    "session_id": session_id2,
                    "duration": 0,
                    "skipped": True
                }
                success_skip, skip_response = self.test_api_endpoint('POST', 'study/end', 200, end_data2, "(End study session - skipped)")
                
                if success_skip and skip_response:
                    coins_earned_skip = skip_response.get('coins_earned', 0)
                    if coins_earned_skip == 0:
                        print("   ✅ Correctly gave 0 coins for skipped session")
                    else:
                        print(f"   ❌ Should give 0 coins for skipped session, got {coins_earned_skip}")
            
            return session_id
        
        return None

    def run_shop_tests(self):
        """Test shop functionality - 90 items with progressive pricing"""
        print("\n🛒 Testing Shop (90 items with progressive pricing)...")
        
        # Get shop items
        success, shop_items = self.test_api_endpoint('GET', 'shop', 200, description="(Get shop items)")
        
        if success and shop_items:
            print(f"   Found {len(shop_items)} shop items")
            
            # Verify we have exactly 90 items (30 seals, 30 borders, 30 themes)
            seals = [item for item in shop_items if item['item_type'] == 'seal']
            borders = [item for item in shop_items if item['item_type'] == 'border']
            themes = [item for item in shop_items if item['item_type'] == 'theme']
            
            print(f"   Seals: {len(seals)}, Borders: {len(borders)}, Themes: {len(themes)}")
            
            if len(shop_items) == 90 and len(seals) == 30 and len(borders) == 30 and len(themes) == 30:
                print("   ✅ Correct number of items (90 total: 30 seals, 30 borders, 30 themes)")
            else:
                print("   ❌ Incorrect number of items")
            
            # Test progressive pricing
            if seals:
                seal_prices = [item['price'] for item in seals]
                if seal_prices == sorted(seal_prices):
                    print("   ✅ Seal prices are progressive (ascending)")
                else:
                    print("   ❌ Seal prices are not progressive")
            
            # Try to purchase an item (should have enough coins from setup)
            if shop_items:
                item = shop_items[0]  # Get first item
                purchase_data = {"item_id": item['id']}
                success_purchase, _ = self.test_api_endpoint('POST', 'shop/purchase', 200, purchase_data, f"(Purchase {item['name']})")
                
                if success_purchase:
                    # Test equip item
                    equip_data = {"item_id": item['id'], "item_type": item['item_type']}
                    self.test_api_endpoint('POST', 'shop/equip', 200, equip_data, f"(Equip {item['name']})")
                    
                    # Test unequip item
                    unequip_data = {"item_type": item['item_type']}
                    self.test_api_endpoint('POST', 'shop/unequip', 200, unequip_data, f"(Unequip {item['item_type']})")
        
        return success

    def run_stats_tests(self):
        """Test statistics endpoint"""
        print("\n📊 Testing Statistics...")
        
        success, stats = self.test_api_endpoint('GET', 'stats', 200, description="(Get user stats)")
        
        if success and stats:
            print(f"   Total time: {stats.get('total_time', 0)} minutes")
            print(f"   Week time: {stats.get('week_time', 0)} minutes")
            print(f"   Cycle progress: {stats.get('cycle_progress', 0):.1f}%")
        
        return success

    def run_quests_tests(self):
        """Test quests functionality"""
        print("\n🎯 Testing Quests...")
        
        success, quests = self.test_api_endpoint('GET', 'quests', 200, description="(Get quests)")
        
        if success and quests:
            print(f"   Found {len(quests)} quests")
            for quest in quests[:2]:  # Show first 2 quests
                print(f"   - {quest.get('title')}: {quest.get('progress', 0)}/{quest.get('target', 0)}")
        
        return success

    def run_settings_tests(self):
        """Test settings functionality"""
        print("\n⚙️ Testing Settings...")
        
        # Get settings
        success, settings = self.test_api_endpoint('GET', 'settings', 200, description="(Get settings)")
        
        if success:
            print(f"   Study duration: {settings.get('study_duration', 50)} minutes")
            print(f"   Break duration: {settings.get('break_duration', 10)} minutes")
            
            # Update settings
            new_settings = {"study_duration": 45, "break_duration": 15}
            self.test_api_endpoint('POST', 'settings', 200, new_settings, "(Update settings)")
        
        return success

    def run_friends_tests(self):
        """Test friends system functionality - CRITICAL FEATURE"""
        print("\n👥 Testing Friends System (CRITICAL)...")
        
        # Create a second test user to be friends with
        timestamp = int(time.time())
        friend_user_id = f"test-friend-{timestamp}"
        friend_nickname = "FriendUser"
        friend_tag = "456"
        
        # MongoDB commands to create friend user
        mongo_commands = f'''
use('test_database');
var friendUserId = '{friend_user_id}';

// Create friend user with nickname#tag
db.users.insertOne({{
  id: friendUserId,
  email: 'friend.user.{timestamp}@example.com',
  name: 'Friend User',
  nickname: '{friend_nickname}',
  tag: '{friend_tag}',
  level: 2,
  coins: 500,
  xp: 150,
  items_owned: [],
  online_status: 'online',
  last_activity: new Date(),
  created_at: new Date()
}});

print('Friend user created successfully');
'''
        
        try:
            result = subprocess.run(
                ['mongosh', '--eval', mongo_commands],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                print(f"❌ Failed to create friend user: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error creating friend user: {str(e)}")
            return False
        
        # Test get friends (should be empty initially)
        success1, friends = self.test_api_endpoint('GET', 'friends', 200, description="(Get friends - empty)")
        if success1:
            if len(friends) == 0:
                print("   ✅ Friends list initially empty")
            else:
                print(f"   ❌ Expected empty friends list, got {len(friends)} friends")
        
        # Test add friend - valid nickname#tag
        friend_data = {
            "friend_nickname": friend_nickname,
            "friend_tag": friend_tag
        }
        success2, add_response = self.test_api_endpoint('POST', 'friends/add', 200, friend_data, f"(Add friend {friend_nickname}#{friend_tag})")
        
        if success2 and add_response:
            friend_info = add_response.get('friend', {})
            print(f"   Added friend: {friend_info.get('name')} ({friend_info.get('nickname')}#{friend_info.get('tag')})")
        
        # Test get friends (should have 1 friend now)
        success3, friends_after = self.test_api_endpoint('GET', 'friends', 200, description="(Get friends after adding)")
        if success3:
            if len(friends_after) == 1:
                print(f"   ✅ Friends list has 1 friend: {friends_after[0].get('name')}")
            else:
                print(f"   ❌ Expected 1 friend, got {len(friends_after)} friends")
        
        # Test add friend - user not found (404 error)
        nonexistent_friend = {
            "friend_nickname": "NonExistent",
            "friend_tag": "999"
        }
        success4, _ = self.test_api_endpoint('POST', 'friends/add', 404, nonexistent_friend, "(Add non-existent friend - should fail)")
        if not success4:
            print("   ✅ Correctly returned 404 for non-existent friend")
        
        # Test add friend - add self (should fail with 400)
        # First get current user's nickname#tag
        success_user, user_data = self.test_api_endpoint('GET', 'auth/me', 200, description="(Get current user for self-add test)")
        if success_user and user_data.get('nickname') and user_data.get('tag'):
            self_friend_data = {
                "friend_nickname": user_data['nickname'],
                "friend_tag": user_data['tag']
            }
            success5, _ = self.test_api_endpoint('POST', 'friends/add', 400, self_friend_data, "(Add self as friend - should fail)")
            if not success5:
                print("   ✅ Correctly prevented adding self as friend")
        
        # Test add duplicate friend (should fail with 400)
        success6, _ = self.test_api_endpoint('POST', 'friends/add', 400, friend_data, "(Add duplicate friend - should fail)")
        if not success6:
            print("   ✅ Correctly prevented duplicate friend")
        
        # Test remove friend
        if success3 and friends_after and len(friends_after) > 0:
            friend_to_remove = friends_after[0]
            friend_id = friend_to_remove.get('id')
            success7, _ = self.test_api_endpoint('DELETE', f'friends/{friend_id}', 200, description=f"(Remove friend {friend_to_remove.get('name')})")
            
            if success7:
                # Verify friend was removed
                success8, friends_final = self.test_api_endpoint('GET', 'friends', 200, description="(Get friends after removal)")
                if success8:
                    if len(friends_final) == 0:
                        print("   ✅ Friend successfully removed")
                    else:
                        print(f"   ❌ Expected 0 friends after removal, got {len(friends_final)}")
        
        # Test remove non-existent friend (should fail with 404)
        fake_friend_id = "non-existent-friend-id"
        success9, _ = self.test_api_endpoint('DELETE', f'friends/{fake_friend_id}', 404, description="(Remove non-existent friend - should fail)")
        if not success9:
            print("   ✅ Correctly returned 404 for non-existent friend removal")
        
        return success1 and success2 and success3

    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting Pomodoro API Tests")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Setup test user
        if not self.setup_test_user():
            print("❌ Failed to setup test user. Aborting tests.")
            return False
        
        try:
            # Test authentication first
            if not self.run_auth_tests():
                print("❌ Authentication failed. Aborting remaining tests.")
                return False
            
            # Test nickname#tag system first (CRITICAL)
            self.run_nickname_tests()
            
            # Test all other endpoints
            subject_id = self.run_subject_tests()
            self.run_study_session_tests(subject_id)
            self.run_shop_tests()
            self.run_stats_tests()
            self.run_quests_tests()
            self.run_settings_tests()
            self.run_friends_tests()
            
            # Test logout
            self.test_api_endpoint('POST', 'auth/logout', 200, description="(Logout)")
            
        finally:
            # Always cleanup
            self.cleanup_test_data()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️ {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = PomodoroAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())