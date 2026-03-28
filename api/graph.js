export default {
    name: 'graph',
    description: 'Fetches a raid verification graph',
    options: [
        {
            name: 'monster',
            description: 'The monster to get attendance for',
            required: true
        },
        {
            name: 'backgroundcolor',
            description: 'the color of the background of the chart'
        },
        {
            name: 'fontcolor',
            description: 'the color of the text on the chart'
        },
        {
            name: 'linecolor',
            description: 'the color of the line on the chart'
        },
        {
            name: 'fillcolor',
            description: 'the color of the area beneath the line'
        }
    ],
    async execute({ config, res, end, url, supabase }) {
        let monsterName = url.searchParams.get('monster');
        let backgroundColor =  url.searchParams.get('backgroundcolor');
        let fontColor =  url.searchParams.get('fontcolor');
        let lineColor =  url.searchParams.get('linecolor');
        let lineFillColor =  url.searchParams.get('fillcolor');
        
        let { data, error } = await supabase.from(config.supabase.tables.monsters).select('*').eq('monster_name', monsterName).limit(1);
        if (error) return end(500, JSON.stringify({ error: 'Error fetching monster', details: error.message }));
        let monster = data[0];
        if (monster == null) return end(400, JSON.stringify({ error: `Unknown monster "${monsterName}"` }));
        let group = config.roster.monsterGroups.find(b => b.includes(data.monster_name)) || [data.monster_name];

        ({ data, error } = await supabase.from(config.supabase.tables.signups).select('*, event_id (event_id, monster_name)'));
        if (error) return end(500, JSON.stringify({ error: 'Error fetching signups', details: error.message }));
        let signups = data.filter(a => group.includes(a.event_id.monster_name));
        
        let graph = {
            type: 'line',
            data: {
                labels: Array(30).fill(null).map((a, i) => {
                    let date = new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                }),
                datasets: [
                    {
                        data: Array(31).fill(0),
                        fill: true,
                        borderColor: lineColor || config.graph.lineColor,
                        backgroundColor: lineFillColor || config.graph.lineFillColor,
                        pointRadius: 0,
                    }
                ]
            },
            options: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: ''
                },
                scales: {
                    yAxes: [
                        {
                            gridLines: {
                                display: true,
                                color: fontColor || config.graph.fontColor
                            },
                            ticks: {
                                precision: 0,
                                beginAtZero: true,
                                fontColor: fontColor || config.graph.fontColor,
                            },
                            scaleLabel: {
                                display: true,
                                labelString: 'Signups',
                                fontColor: fontColor || config.graph.fontColor
                            }
                        }
                    ],
                    xAxes: [
                        {
                            ticks: {
                                precision: 0,
                                beginAtZero: true,
                                fontColor: fontColor || config.graph.fontColor,
                            }
                        }
                    ]
                }
            }
        }
        signups.forEach(signup => {
            let day = Math.floor((new Date(signup.date).getTime() - (Date.now() - (30 * 24 * 60 * 60 * 1000))) / (24 * 60 * 60 * 1000));
            graph.data.datasets[0].data[day]++;
        });
        let location = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(graph))}&backgroundColor=${encodeURIComponent(backgroundColor || config.graph.backgroundColor)}`;
        res.setHeader('Location', location);
        end(303);
    }
}