#include <iostream>
#include <vector>
#include <string>

class AdvancedCalculator {
public:
    int add(int a, int b) { return a + b; }
    int subtract(int a, int b) { return a - b; }
    int multiply(int a, int b) { return a * b; }

    double divide(int a, int b) {
        if (b == 0) {
            std::cerr << "Division by zero!" << std::endl;
            return 0;
        }
        return static_cast<double>(a) / b;
    }

    // New modulo operation
    int modulo(int a, int b) {
        if (b == 0) {
            std::cerr << "Modulo by zero!" << std::endl;
            return 0;
        }
        return a % b;
    }
};

std::string reverseString(const std::string& s) {
    std::string result = s;
    int n = result.length();
    for (int i = 0; i < n / 2; ++i) {
        std::swap(result[i], result[n - i - 1]);
    }
    return result;
}

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    AdvancedCalculator calc;
    int a = 10, b = 3;
    std::cout << "Add: " << calc.add(a, b) << std::endl;
    std::cout << "Subtract: " << calc.subtract(a, b) << std::endl;
    std::cout << "Multiply: " << calc.multiply(a, b) << std::endl;
    std::cout << "Divide: " << calc.divide(a, b) << std::endl;
    std::cout << "Modulo: " << calc.modulo(a, b) << std::endl;

    std::string text = "hello sairudra";
    std::cout << "Reverse: " << reverseString(text) << std::endl;

    int n = 10;
    
    std::cout << "Fibonacci(" << n << "): " << fibonacci(n) << std::endl;

    std::vector<int> nums = {1, 2, 3, 4, 5};
    for (int num : nums) {
        std::cout << "Num: " << num << std::endl;
    }

    return 0;
}