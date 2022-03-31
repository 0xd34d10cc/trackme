#pragma once

#include <cstdint>
#include <chrono>
#include <functional>
#include <queue>


using Clock = std::chrono::system_clock;
using TimePoint = Clock::time_point;
using Duration = Clock::duration;
using Milliseconds = std::chrono::milliseconds;

class Executor {
public:
  Executor() = default;

  void spawn(std::function<void()> fn);
  void spawn_at(TimePoint at, std::function<void()> fn);
  void spawn_delayed(Duration delay, std::function<void()> fn);
  void spawn_periodic(Duration period, std::function<void()> fn);

  uint64_t run();

private:
  struct Task {
    TimePoint execute_at;
    std::function<void()> fn;

    bool operator<(const Task& other) const {
      // inverted, because we want min heap
      return execute_at > other.execute_at;
    }
  };

  std::priority_queue<Task> m_tasks;
};