#pragma once

#include "activity.hpp"

#include <string>
#include <fstream>
#include <filesystem>

constexpr std::string_view TEMPLATE_START = R"(<html>
  <head>
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <script type="text/javascript">
      google.charts.load('current', {'packages':['timeline']});
      google.charts.setOnLoadCallback(drawChart);
      function drawChart() {
        var container = document.getElementById('timeline');
        var chart = new google.visualization.Timeline(container);
        var dataTable = new google.visualization.DataTable();

        dataTable.addColumn({ type: 'string', id: 'Title' });
        dataTable.addColumn({ type: 'date', id: 'Start' });
        dataTable.addColumn({ type: 'date', id: 'End' });
        dataTable.addRows([
)";

constexpr std::string_view TEMPLATE_FIELD = "[ '{}', new Date({}, {}, {}, {}, {}, {}), new Date({}, {}, {}, {}, {}, {}) ],\n";

constexpr std::string_view TEMPLATE_END = R"(])

        chart.draw(dataTable);
      }
    </script>
  </head>
  <body>
    <div id="timeline" style="height: 100vh;"></div>
  </body>
</html>
)";


class TimelineVisualizer {
 public:
  TimelineVisualizer(std::ostream& stream) : m_stream(stream) {
    m_stream << TEMPLATE_START;
  }

  void add_activity(const ActivityEntry& activity) {
    auto curr_day = round_down<Days>(activity.begin);
    auto begin = std::chrono::hh_mm_ss(activity.begin - curr_day);
    auto end = std::chrono::hh_mm_ss(activity.end - curr_day);
    auto curr_date = Date(curr_day);

    // TODO: refactor this
    const auto js_escape = [](std::string_view s) {
      std::string out;
      for (char c : s) {
        if (c == '\'' || c == '\\') {
          out.push_back('\\');
        }

        out.push_back(c);
      }

      return out;
    };

    const auto exe_filename =
        std::filesystem::path(activity.executable).filename().string();
    m_stream << std::format(
        TEMPLATE_FIELD, js_escape(exe_filename), int(curr_date.year()),
        unsigned int(curr_date.month()), unsigned int(curr_date.day()),
        begin.hours().count(), begin.minutes().count(), begin.seconds().count(),
        int(curr_date.year()), unsigned int(curr_date.month()),
        unsigned int(curr_date.day()), end.hours().count(),
        end.minutes().count(), end.seconds().count());
  }

  ~TimelineVisualizer() {
    m_stream << TEMPLATE_END;
    m_stream.flush();
  }

 private:
  std::ostream& m_stream;
};
