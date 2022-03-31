#include "executor.hpp"

#include <thread>


void Executor::spawn(TaskFn fn) {
  spawn_at(Clock::now(), std::move(fn));
}

void Executor::spawn_at(TimePoint at, TaskFn fn) {
  m_tasks.emplace(Task{ at, std::move(fn) });
}

void Executor::spawn_delayed(Duration delay, TaskFn fn) {
  spawn_at(Clock::now() + delay, std::move(fn));
}

void Executor::spawn_periodic(Duration period, TaskFn fn) {
  spawn_delayed(period, [this, period, f{ std::move(fn) }] () mutable {
    f();

    // FIXME: execution of f() could take a lot of time
    spawn_periodic(period, std::move(f));
  });
}

TaskFn Executor::next_task() {
  if (!m_running || m_tasks.empty()) {
    return TaskFn();
  }

  {
    const auto now = Clock::now();
    auto& task = m_tasks.top();
    if (task.execute_at <= now) {
      auto fn = task.fn;
      m_tasks.pop();
      return fn;
    }
    std::this_thread::sleep_for(task.execute_at - now);
  }

  auto fn = m_tasks.top().fn;
  m_tasks.pop();
  return fn;
}

uint64_t Executor::run() {
  m_running = true;

  uint64_t ticks = 0;
  while (auto fn = next_task()) {
    fn();
    ++ticks;
  }

  return ticks;
}

void Executor::stop() {
  m_running = false;
}