#include "executor.hpp"

#include <thread>


void Executor::spawn(std::function<void()> fn) {
  spawn_at(Clock::now(), std::move(fn));
}

void Executor::spawn_at(TimePoint at, std::function<void()> fn) {
  m_tasks.emplace(Task{ at, std::move(fn) });
}

void Executor::spawn_delayed(Duration delay, std::function<void()> fn) {
  spawn_at(Clock::now() + delay, std::move(fn));
}

void Executor::spawn_periodic(Duration period, std::function<void()> fn) {
  spawn_delayed(period, [this, period, f{ std::move(fn) }] () mutable{
    f();
    spawn_periodic(period, std::move(f));
  });
}

uint64_t Executor::run() {
  uint64_t ticks = 0;

  while (!m_tasks.empty()) {
    // wait for task
    {
      const auto& task = m_tasks.top();
      auto now = Clock::now();
      std::this_thread::sleep_for(now - task.execute_at + Milliseconds(1));
    }

    // execute ready tasks
    while (!m_tasks.empty()) {
      auto& task = m_tasks.top();
      const auto now = Clock::now();
      if (task.execute_at > now) {
        break;
      }

      auto fn = std::move(task.fn);
      m_tasks.pop();
      fn();
    }

    ++ticks;
  }

  return ticks;
}