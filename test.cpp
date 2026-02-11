#include <functional>
#include <iostream>

int main() {
    std::function<int(int)> square = [](int x) { return x * x; };
    std::cout << square(5) << std::endl;
    return 0;
}
