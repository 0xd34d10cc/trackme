#pragma once

#include <functional>
#include <queue>
#include <atomic>

#include "time.hpp"


using TaskFn = std::function<void()>;

class Executor {
public:
  Executor() = default;

  void spawn(TaskFn fn);
  void spawn_at(TimePoint at, TaskFn fn);
  void spawn_delayed(Duration delay, TaskFn fn);
  void spawn_periodic(Duration period, TaskFn fn);
  void spawn_periodic_at(TimePoint at, Duration period, TaskFn fn);

  int run();
  int run(TimePoint deadline);

  void stop();

private:
  struct Task {
    TimePoint execute_at;
    TaskFn fn;

    bool operator>(const Task& other) const {
      return execute_at > other.execute_at;
    }
  };

  using TaskQueue = std::priority_queue<Task, std::vector<Task>, std::greater<Task>>;

  std::atomic<bool> m_running{ false };
  TaskQueue m_tasks;
};