/* =====================================================================
   Anthropic-Inspired Editorial Charts and Player Logic
   ===================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Global Data Store
  let globalData = null;
  let currentSankeyData = null;

  // Initialize Page
  if (typeof DB_DATA !== 'undefined') {
    const data = DB_DATA;
    globalData = data;

    // Helper to log errors to the visual diagnostics panel
    function runSafe(name, fn) {
      try {
        fn();
      } catch (err) {
        console.error('Erro em ' + name + ':', err);
        if (typeof logDebug === 'function') {
          logDebug('<span style="color:#ff3333;">Erro em ' + name + ': ' + err.message + '</span>');
        }
      }
    }

    runSafe('initAudioPlayer', () => initAudioPlayer());
    runSafe('initSankeyChart', () => initSankeyChart(data.sankey_data));
    runSafe('initHistoricalChart', () => initHistoricalChart(data.temporal_metrics));
    runSafe('initKMeansChart', () => initKMeansChart(data.kmeans_data, data.kmeans_centroids));
    runSafe('initTemporalClustersChart', () => initTemporalClustersChart(data.temporal_clusters));
    runSafe('initWordEvolutionChart', () => initWordEvolutionChart(data.word_evolution));
    runSafe('initNetworkChart', () => initNetworkChart(data.network_data));
    
    // Hook up Sankey Filter
    try {
      document.getElementById('sankey-filter').addEventListener('change', (e) => {
        filterSankey(e.target.value);
      });
    } catch (err) {
      if (typeof logDebug === 'function') logDebug('Erro ao vincular filtro Sankey: ' + err.message);
    }
  } else {
    console.error('Falha na inicialização do painel: DB_DATA não está definido.');
    document.querySelectorAll('.chart-container').forEach(el => {
      el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#d97757;font-family:monospace;font-size:0.9rem;">[Erro ao carregar dados: certifique-se de que o arquivo data.js está na raiz do projeto]</div>`;
    });
  }

  /* =====================================================================
     1. CUSTOM AUDIO PLAYER WITH WEB AUDIO SYNTHESIS FALLBACK
     ===================================================================== */
  function initAudioPlayer() {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playPath = document.getElementById('play-path');
    const pausePath = document.getElementById('pause-path');
    const audioProgressFill = document.getElementById('audio-progress-fill');
    const audioProgressBg = document.getElementById('audio-progress-bg');
    const currentTimeText = document.getElementById('current-time');
    const durationTimeText = document.getElementById('duration-time');
    const audioElement = document.getElementById('audio-element');
    
    let isPlaying = false;
    let simulatedDuration = 600; // 10 minutes in seconds
    let simulatedCurrentTime = 0;
    let audioTimer = null;
    let useSimulation = true;

    // Web Audio Synthesizer Fallback variables
    let audioCtx = null;
    let osc1 = null;
    let osc2 = null;
    let gainNode = null;

    function startSynth() {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        osc1 = audioCtx.createOscillator();
        osc2 = audioCtx.createOscillator();
        gainNode = audioCtx.createGain();

        // High-tech, warm ambient hum (harmonic frequency combination: 110Hz and 165Hz - perfect fifth)
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(110, audioCtx.currentTime); // A2
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(165, audioCtx.currentTime); // E3

        gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime); // safe low volume
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc1.start();
        osc2.start();
      } catch (e) {
        console.warn('Web Audio API não suportada ou bloqueada por políticas de gestos do usuário.');
      }
    }

    function stopSynth() {
      try {
        if (osc1) osc1.stop();
        if (osc2) osc2.stop();
        if (audioCtx) audioCtx.close();
        osc1 = null;
        osc2 = null;
        audioCtx = null;
      } catch(e) {}
    }

    // Try to load metadata of actual mp3 to see if it exists
    audioElement.addEventListener('loadedmetadata', () => {
      useSimulation = false;
      simulatedDuration = audioElement.duration;
      durationTimeText.textContent = formatTime(simulatedDuration);
    });

    audioElement.addEventListener('error', () => {
      // Keep simulation = true if the file is missing (expected for placeholder)
      useSimulation = true;
      durationTimeText.textContent = "10:00";
    });

    function formatTime(secs) {
      const minutes = Math.floor(secs / 60);
      const seconds = Math.floor(secs % 60);
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    function updateProgressUI(time, duration) {
      const percentage = (time / duration) * 100;
      audioProgressFill.style.width = `${percentage}%`;
      currentTimeText.textContent = formatTime(time);
    }

    function togglePlayback() {
      if (isPlaying) {
        // PAUSE
        isPlaying = false;
        playPath.style.display = 'block';
        pausePath.style.display = 'none';

        if (useSimulation) {
          clearInterval(audioTimer);
          stopSynth();
        } else {
          audioElement.pause();
        }
      } else {
        // PLAY
        isPlaying = true;
        playPath.style.display = 'none';
        pausePath.style.display = 'block';

        if (useSimulation) {
          startSynth();
          audioTimer = setInterval(() => {
            simulatedCurrentTime += 1;
            if (simulatedCurrentTime >= simulatedDuration) {
              simulatedCurrentTime = 0;
              togglePlayback(); // loop/stop
            }
            updateProgressUI(simulatedCurrentTime, simulatedDuration);
          }, 1000);
        } else {
          audioElement.play().catch(err => {
            console.warn("Falha ao tocar MP3 físico. Ativando simulador de áudio sintético.");
            useSimulation = true;
            togglePlayback(); // re-toggle in simulated mode
          });
        }
      }
    }

    // Handle clicks
    playPauseBtn.addEventListener('click', togglePlayback);

    // Audio element standard updates (if physical mp3 plays)
    audioElement.addEventListener('timeupdate', () => {
      if (!useSimulation) {
        updateProgressUI(audioElement.currentTime, audioElement.duration || simulatedDuration);
      }
    });

    // Progress bar seeking
    audioProgressBg.addEventListener('click', (e) => {
      const rect = audioProgressBg.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      
      if (useSimulation) {
        simulatedCurrentTime = clickPosition * simulatedDuration;
        updateProgressUI(simulatedCurrentTime, simulatedDuration);
      } else {
        audioElement.currentTime = clickPosition * audioElement.duration;
      }
    });
  }

  /* =====================================================================
     2. SANKEY DIAGRAM (Knowledge Flow)
     ===================================================================== */
  // currentSankeyData is declared at the top scope

  function initSankeyChart(data) {
    currentSankeyData = data;
    renderSankey(data);
  }

  function filterSankey(filterValue) {
    if (!globalData) return;
    
    let filtered = globalData.sankey_data;
    if (filterValue !== 'all') {
      const mapping = {
        'exatas': 'Ciências Exatas e da Terra',
        'biologicas': 'Ciências Biológicas',
        'engenharias': 'Engenharias',
        'saude': 'Ciências da Saúde',
        'agrarias': 'Ciências Agrárias',
        'sociais': 'Ciências Sociais Aplicadas',
        'humanas': 'Ciências Humanas',
        'artes': 'Linguística, Letras e Artes'
      };
      
      const targetArea = mapping[filterValue];
      filtered = globalData.sankey_data.filter(link => 
        link.source.startsWith(targetArea)
      );
    }
    
    renderSankey(filtered);
  }

  function renderSankey(links) {
    // Generate unique node names
    const nodeNames = [];
    links.forEach(link => {
      if (!nodeNames.includes(link.source)) nodeNames.push(link.source);
      if (!nodeNames.includes(link.target)) nodeNames.push(link.target);
    });

    // Sort to keep order consistent
    nodeNames.sort();

    // Map source/target to indices
    const nodeMapping = {};
    nodeNames.forEach((name, i) => {
      nodeMapping[name] = i;
    });

    const sources = links.map(link => nodeMapping[link.source]);
    const targets = links.map(link => nodeMapping[link.target]);
    const values = links.map(link => link.value);

    // Color definitions
    const areaColors = {
      "Ciências Exatas e da Terra": "#6a9bcc",
      "Ciências Biológicas": "#788c5d",
      "Engenharias": "#d97757",
      "Ciências da Saúde": "#8c6b7c",
      "Ciências Agrárias": "#bda06a",
      "Ciências Sociais Aplicadas": "#a09280",
      "Ciências Humanas": "#807e76",
      "Linguística, Letras e Artes": "#c2a9a0"
    };

    // Helper to extract base area name
    function getBaseArea(label) {
      return label.replace(' (Pesquisador)', '').replace(' (Projeto)', '');
    }

    const nodeColors = nodeNames.map(name => {
      const base = getBaseArea(name);
      return areaColors[base] || "gray";
    });

    // Helper to convert hex to rgba
    function hexToRgba(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const linkColors = links.map(link => {
      const base = getBaseArea(link.source);
      const hex = areaColors[base] || "#888888";
      return hexToRgba(hex, 0.35); // 35% opacity fluid links
    });

    const trace = {
      type: "sankey",
      orientation: "h",
      node: {
        pad: 18,
        thickness: 24,
        line: {
          color: "rgba(0,0,0,0.15)",
          width: 0.5
        },
        label: nodeNames,
        color: nodeColors,
        font: {
          family: "'Plus Jakarta Sans', sans-serif",
          size: 11,
          color: '#191919'
        }
      },
      link: {
        source: sources,
        target: targets,
        value: values,
        color: linkColors
      }
    };

    const layout = {
      font: {
        family: "'Plus Jakarta Sans', sans-serif",
        size: 11,
        color: '#191919'
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      height: 600,
      margin: {
        t: 30,
        b: 30,
        l: 10,
        r: 10
      }
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    Plotly.newPlot('sankey-chart', [trace], layout, config);
  }

  /* =====================================================================
     3. HISTORICAL METRICS CHART (Shannon vs. Cohesion - Dual Y-Axis)
     ===================================================================== */
  function initHistoricalChart(metrics) {
    // Sort chronologically by year to prevent zig-zag line artifacts
    metrics.sort((a, b) => a.year - b.year);
    const years = metrics.map(m => m.year);
    const shannon = metrics.map(m => m.shannon);
    const cohesion = metrics.map(m => m.cohesion);

    const traceShannon = {
      x: years,
      y: shannon,
      name: 'Média Diversidade (Shannon)',
      type: 'scatter',
      mode: 'lines+markers',
      line: {
        color: '#6a9bcc',
        width: 2.5,
        shape: 'spline'
      },
      marker: {
        size: 6,
        color: '#6a9bcc'
      },
      yaxis: 'y1'
    };

    const traceCohesion = {
      x: years,
      y: cohesion,
      name: 'Média Coesão (Densidade)',
      type: 'scatter',
      mode: 'lines+markers',
      line: {
        color: '#d97757',
        width: 2.5,
        shape: 'spline'
      },
      marker: {
        size: 6,
        color: '#d97757',
        symbol: 'square'
      },
      yaxis: 'y2'
    };

    const layout = {
      font: {
        family: "'Plus Jakarta Sans', sans-serif",
        size: 12,
        color: '#191919'
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      xaxis: {
        title: 'Ano de Início do Projeto',
        gridcolor: '#e8e6dc',
        zeroline: false,
        linecolor: '#191919',
        linewidth: 0.8
      },
      yaxis: {
        title: 'Índice de Shannon (Diversidade)',
        titlefont: {color: '#6a9bcc'},
        tickfont: {color: '#6a9bcc'},
        gridcolor: '#e8e6dc',
        zeroline: false,
        linecolor: '#191919',
        linewidth: 0.8
      },
      yaxis2: {
        title: 'Índice de Coesão (Densidade da Rede)',
        titlefont: {color: '#d97757'},
        tickfont: {color: '#d97757'},
        overlaying: 'y',
        side: 'right',
        zeroline: false,
        showgrid: false,
        linecolor: '#191919',
        linewidth: 0.8
      },
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.15,
        font: { size: 11 }
      },
      margin: {
        t: 40,
        b: 50,
        l: 50,
        r: 50
      },
      height: 450
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    Plotly.newPlot('historical-chart', [traceShannon, traceCohesion], layout, config);
  }

  /* =====================================================================
     4. K-MEANS SCATTER CHART (Cohesion vs Shannon with Centroids)
     ===================================================================== */
  function initKMeansChart(points, centroids) {
    // Map cluster names to colors (corrected spelling to match data.js)
    const clusterColors = {
      "1. Interdisciplinaridade especializada": "#788c5d",
      "2. Disciplina especializada": "#d97757",
      "3. Potencial integração dentro da disciplina": "#6a9bcc",
      "4. Potencial integração interdisciplinar": "#8c6b7c"
    };

    // Group points by cluster to plot separate traces (for interactive legend)
    const traces = [];
    const groups = {};

    // Filter out extreme outlier processes to improve axis distribution
    const outliers = new Set(['15/15793-1', '21/12360-8', '12/51088-2']);

    points.forEach(pt => {
      if (outliers.has(pt.processo)) return; // Skip extreme outliers
      
      if (!groups[pt.cluster]) {
        groups[pt.cluster] = {
          x: [],
          y: [],
          text: [],
          name: pt.cluster
        };
      }
      groups[pt.cluster].x.push(pt.cohesion);
      groups[pt.cluster].y.push(pt.shannon);
      groups[pt.cluster].text.push(
        `Processo: ${pt.processo}<br>Grande Área: ${pt.area}<br>Coesão: ${pt.cohesion}<br>Shannon: ${pt.shannon}`
      );
    });

    // Add points traces
    for (const key in groups) {
      traces.push({
        x: groups[key].x,
        y: groups[key].y,
        text: groups[key].text,
        name: key,
        mode: 'markers',
        type: 'scatter',
        hoverinfo: 'text',
        marker: {
          size: 9,
          color: clusterColors[key] || '#888888',
          opacity: 0.75,
          line: {
            color: '#ffffff',
            width: 0.5
          }
        }
      });
    }

    const layout = {
      font: {
        family: "'Plus Jakarta Sans', sans-serif",
        size: 12,
        color: '#191919'
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      xaxis: {
        title: 'Índice de Coesão',
        gridcolor: '#e8e6dc',
        zeroline: false,
        linecolor: '#191919',
        linewidth: 0.8
      },
      yaxis: {
        title: 'Índice de Diversidade',
        gridcolor: '#e8e6dc',
        zeroline: false,
        linecolor: '#191919',
        linewidth: 0.8
      },
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.25,
        font: { size: 10 }
      },
      margin: {
        t: 40,
        b: 50,
        l: 50,
        r: 30
      },
      height: 580
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    Plotly.newPlot('kmeans-chart', traces, layout, config);
  }

  /* =====================================================================
     5. TEMPORAL VOLUME OF PROJECTS PER CLUSTER
     ===================================================================== */
  function initTemporalClustersChart(data) {
    // Sort data chronologically by year to prevent zig-zag lines
    data.sort((a, b) => a.year - b.year);
    const years = data.map(d => d.year);
    
    const clusterKeys = [
      "1. Interdisciplinaridade especializada",
      "2. Disciplina especializada",
      "3. Potencial integração dentro da disciplina",
      "4. Potencial integração interdisciplinar"
    ];

    const clusterColors = {
      "1. Interdisciplinaridade especializada": "#788c5d",
      "2. Disciplina especializada": "#d97757",
      "3. Potencial integração dentro da disciplina": "#6a9bcc",
      "4. Potencial integração interdisciplinar": "#8c6b7c"
    };

    const traces = clusterKeys.map(key => {
      return {
        x: years,
        y: data.map(d => d[key]),
        name: key,
        type: 'scatter',
        mode: 'lines+markers',
        line: {
          color: clusterColors[key],
          width: 2
        },
        marker: {
          size: 5,
          color: clusterColors[key]
        }
      };
    });

    const layout = {
      font: {
        family: "'Plus Jakarta Sans', sans-serif",
        size: 12,
        color: '#191919'
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      xaxis: {
        title: 'Ano de Início',
        gridcolor: '#e8e6dc',
        zeroline: false,
        linecolor: '#191919',
        linewidth: 0.8
      },
      yaxis: {
        title: 'Quantidade de Projetos',
        gridcolor: '#e8e6dc',
        zeroline: false,
        linecolor: '#191919',
        linewidth: 0.8
      },
      // Highlight the post-2015 period (AI Wave / Transition)
      shapes: [{
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: 2015,
        x1: 2022,
        y0: 0,
        y1: 1,
        fillcolor: 'rgba(217, 119, 87, 0.05)',
        line: {
          width: 0
        }
      }, {
        type: 'line',
        x0: 2015,
        y0: 0,
        x1: 2015,
        y1: 150,
        yref: 'y',
        line: {
          color: '#d97757',
          width: 1.5,
          dash: 'dashdot'
        }
      }],
      annotations: [{
        x: 2015,
        y: 120,
        xref: 'x',
        yref: 'y',
        text: 'Virada Interdisciplinar (2015)',
        showarrow: true,
        arrowhead: 2,
        ax: -70,
        ay: -30,
        font: {
          size: 11,
          color: '#d97757',
          weight: 'bold'
        }
      }],
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.2,
        font: { size: 10 }
      },
      margin: {
        t: 40,
        b: 50,
        l: 50,
        r: 30
      },
      height: 450
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    Plotly.newPlot('temporal-clusters-chart', traces, layout, config);
  }

  /* =====================================================================
     5B. CUMULATIVE WORD EVOLUTION LINE CHART
     ===================================================================== */
  function initWordEvolutionChart(data) {
    // Handle potential PowerShell array wrapping under the "value" property
    const list = Array.isArray(data) ? data : (data && data.value ? data.value : []);
    if (!list || list.length === 0) return;

    // Sort list by total count in the last year (2022) descending
    list.sort((a, b) => b.total_2022 - a.total_2022);

    // Define a warm-to-muted gradient palette of 24 colors
    const hotToMutedColors = [
      "#e03e1b", // Rank 1: Deep red/crimson
      "#e35b1c", // Rank 2: Bright red-orange
      "#e6771d", // Rank 3: Rich orange
      "#e8901f", // Rank 4: Warm amber
      "#eba922", // Rank 5: Golden yellow
      "#ecc026", // Rank 6: Warm yellow
      "#edd42f", // Rank 7: Soft yellow
      "#d2bf4c", // Rank 8: Olive gold
      "#c3b567", // Rank 9: Pale gold-green
      "#b4aa7e", // Rank 10: Muted khaki
      "#a59e91", // Rank 11: Warm stone grey
      "#9ca197", // Rank 12: Sage stone
      "#91a3a3", // Rank 13: Muted slate
      "#8ca5b0", // Rank 14: Soft steel blue
      "#88a1b5", // Rank 15: Dusty blue
      "#829cb3", // Rank 16: Muted blue
      "#8a97a3", // Rank 17: Grey-blue
      "#919396", // Rank 18: Neutral grey
      "#9c9c9c", // Rank 19: Medium grey
      "#ababab", // Rank 20: Light grey
      "#bababa", // Rank 21: Pale grey
      "#c9c9c9", // Rank 22: Very pale grey
      "#d8d8d8", // Rank 23: Soft cream-grey
      "#e7e7e7"  // Rank 24: Cream
    ];

    const traces = list.map((item, index) => {
      // Ensure series is sorted by year chronologically
      item.series.sort((a, b) => a.year - b.year);
      
      const years = item.series.map(s => s.year);
      const counts = item.series.map(s => s.count);
      const color = hotToMutedColors[index] || "#999999";
      const isTop = index < 5;

      return {
        x: years,
        y: counts,
        name: `${index + 1}. ${item.assunto} (${item.total_2022})`,
        type: 'scatter',
        mode: 'lines+markers',
        line: {
          color: color,
          width: isTop ? 3.0 : 1.5,
          shape: 'spline'
        },
        marker: {
          size: isTop ? 5 : 3,
          color: color
        }
      };
    });

    const layout = {
      font: {
        family: "'Plus Jakarta Sans', sans-serif",
        size: 11,
        color: '#191919'
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      xaxis: {
        title: 'Ano de Início',
        gridcolor: '#e8e6dc',
        zeroline: false,
        linecolor: '#191919',
        linewidth: 0.8,
        dtick: 2
      },
      yaxis: {
        title: 'Volume Cumulativo de Projetos',
        gridcolor: '#e8e6dc',
        zeroline: false,
        linecolor: '#191919',
        linewidth: 0.8
      },
      legend: {
        font: { size: 10 },
        y: 0.5,
        x: 1.05,
        yanchor: 'middle'
      },
      margin: {
        t: 40,
        b: 50,
        l: 50,
        r: 220
      },
      height: 600
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    Plotly.newPlot('word-evolution-chart', traces, layout, config);
  }

  /* =====================================================================
     6. COLLABORATION NETWORK CHART (vis.js)
     ===================================================================== */
  function initNetworkChart(data) {
    const container = document.getElementById('network-chart');

    // Create vis.js Node objects
    const nodes = data.nodes.map(n => {
      let cleanLabel = n.label;
      if (cleanLabel === 'nan' || cleanLabel === 'NaN') {
        cleanLabel = 'Interdisciplinar';
      }
      return {
        id: n.id,
        label: n.isHub ? cleanLabel : "",
        size: n.size,
        color: {
          background: n.color,
          border: darkenColor(n.color, 20),
          highlight: {
            background: darkenColor(n.color, 10),
            border: darkenColor(n.color, 30)
          }
        },
        font: {
          color: '#191919',
          size: 12,
          face: "'Plus Jakarta Sans', sans-serif"
        },
        title: cleanLabel
      };
    });

    // Create vis.js Edge objects
    const edges = data.edges.map(e => {
      return {
        from: e.from,
        to: e.to,
        color: {
          color: 'rgba(0, 0, 0, 0.18)', // soft grey line for light background
          highlight: 'rgba(217, 119, 87, 0.6)',
          hover: 'rgba(217, 119, 87, 0.4)'
        },
        width: e.width || 1
      };
    });

    const chartData = {
      nodes: new vis.DataSet(nodes),
      edges: new vis.DataSet(edges)
    };

    const options = {
      width: '100%',
      height: '600px',
      nodes: {
        shape: 'dot',
        borderWidth: 1.5,
        shadow: false
      },
      edges: {
        smooth: {
          type: 'continuous',
          forceDirection: 'none',
          roundness: 0.5
        }
      },
      physics: {
        forceAtlas2Based: {
          gravitationalConstant: -26,
          centralGravity: 0.005,
          springLength: 90,
          springConstant: 0.18
        },
        maxVelocity: 146,
        solver: 'forceAtlas2Based',
        timestep: 0.35,
        stabilization: {
          enabled: true,
          iterations: 150,
          updateInterval: 25
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true
      }
    };

    // Initialize network
    const network = new vis.Network(container, chartData, options);

    // Helper to darken colors for node borders
    function darkenColor(col, amt) {
      col = col.replace('#', '');
      let num = parseInt(col, 16);
      let r = (num >> 16) - amt;
      let g = ((num >> 8) & 0x00FF) - amt;
      let b = (num & 0x0000FF) - amt;
      
      r = Math.max(0, r);
      g = Math.max(0, g);
      b = Math.max(0, b);
      
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
  }
});
