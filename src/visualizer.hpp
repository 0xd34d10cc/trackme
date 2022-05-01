#pragma once

#include "activity.hpp"

#include <string>
#include <fstream>

constexpr std::string_view TEMPLATE_START = R"XYI(<html>
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
)XYI";

constexpr std::string_view TEMPLATE_FIELD = R"XYI(
          [ '{}', new Date({}, {}, {}, {}, {}, {}), new Date({}, {}, {}, {}, {}, {}) ],
)XYI";

constexpr std::string_view TEMPLATE_END = R"XYI(])

        chart.draw(dataTable);
      }
    </script>
  </head>
  <body>
    <div id="timeline" style="height: 100vh;"></div>
  </body>
</html>
)XYI";

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

      m_stream << std::format(
          TEMPLATE_FIELD, activity.title, int(curr_date.year()),
          unsigned int(curr_date.month()), unsigned int(curr_date.day()),
          begin.hours().count(), begin.minutes().count(),
          begin.seconds().count(), int(curr_date.year()),
          unsigned int(curr_date.month()), unsigned int(curr_date.day()),
          end.hours().count(), end.minutes().count(), end.seconds().count());
    }

    ~TimelineVisualizer() {
      m_stream << TEMPLATE_END;
      m_stream.flush();
    }
  private:
    std::ostream& m_stream;

};
