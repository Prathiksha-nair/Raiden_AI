import requests
import json

def test_math_solver():
    # Test cases
    test_cases = [
        "34+78/3",  # Simple arithmetic
        "2x + 5 = 15",  # Linear equation
        "x^2 - 4 = 0",  # Quadratic equation
        "3x + 2y = 10",  # Multiple variables
        "sqrt(16)",  # Function
    ]
    
    print("Testing Enhanced Math Solver\n")
    print("=" * 50)
    
    for equation in test_cases:
        print(f"\nTesting: {equation}")
        print("-" * 30)
        
        try:
            response = requests.post(
                'http://localhost:5000/solve_math',
                json={'equation': equation},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success!")
                print(f"Solution: {data.get('solution', 'N/A')}")
                print(f"Explanation: {data.get('explanation', 'N/A')[:200]}...")
            else:
                print(f"❌ Error: {response.status_code}")
                print(f"Response: {response.text}")
                
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
        
        print()

if __name__ == "__main__":
    test_math_solver() 