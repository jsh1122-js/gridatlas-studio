(() => {
  'use strict';
  const DEG = Math.PI / 180, EARTH = 6371.0088, MAX_PINS = 8, RADIUS = 15;
  const reliefUrl = new URL('relief.webp', document.currentScript?.src || location.href);
  const INITIAL_ANGLE = -0.48, INITIAL_TILT = 0.64;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const shortDistance = km => km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(2) + ' km';
  const font = (weight, size, mono = false) => `${weight} ${size}px ${mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'system-ui, -apple-system, "PingFang SC", sans-serif'}`;
  const cap = n => String(n).padStart(2, '0');
  const cache = new Map();
  // 97 × 97 samples from the bundled region's z11 Terrarium DEM mosaic, 2 m quantization.
  // Source: Mapzen / AWS Terrain Tiles, x=1647…1650, y=779…782. The mosaic spans 1024 pixels.
  const DEM_BYTES = 'rLrCxsC1wMK2rq6ytLK0t7q+xc7TyMCwppqOgoB/dnBwcnBvbm9ucnR6goeSrqqmnpybmJyWnJWGoZOZjIyKhHZgbWl8cFY6ODZMVVZYZWZlaGtseIB6c3JycHJzc3qAebK9wMS/srq2tqyrqqyxt7a4u7/AwLOsoqaekI2HfHVycnBvbnJxcnR4f4KGjpWjop+goaCdnp6Xj4yeloyWhIB0dnGCgnxqVkA5NkRTUVteXl5nbnOBfG9ucHBwcHF4gIS4wMS+vbCsrLKsqKyyt7i8wL7AwrCurJ6amIqEhn54c3JxcXBxcnR2e4CEiI2am56goKSipKOioZ6cnpiIj4qIg3xogH59aF5VOjY0RlJQVllfamxyfn5sbGxsbm5wdHaIusDAvbSsqKaspqeqtL/AxNLLvKykpqSdlJSKgn54dXRycnJxcnN2fn6AhoyMlqGWoKKjoqSroKaknqOYmZqYiIh+coB+fHZqVEw3NT5PUFJaZGVka290aGlramxscXBzerKyu76xqqeloqKosLGzuL/Ivq+mo56imZiPiIR/fnh2dHNydnd4eoOGiIaKjJOboJKZpJekqaCgnKCioJ6an5+IjpCOjnx2ZFtSQzYwOkJUUlZcZGxsZmxlZmRqbHZwcnmssKytr6yjoJ6jqq6wtLbAxMCwpJ+amZaRkYqFgHx5dnZ0dHp9f4OMlJaOjJCSmKCajaCOmZ6hjJaWlpiVnKGgnJaWlZCKe2xkWFw4MTE4Rk5SXGFpYmBiYmhidHh1fIGCqq6mpaCjop+grK6yvL+9wMXYwq6im5SUk4+OiIJ+enh4dnh+hoiNn6WelpWQjpKUopiGiZmgioqMoJCIi5eampiHkn+GiYB6eGROUEIuLjRISlFcZmJeXF1aZ2pqcnN2fKmnoqCcoJ6dnKCsrLK2vsPCyMe3pJ6WkY6LiIyGhH56eHuAiZmXnqCnqaKmnJGLjJackICJnpiAiJaWgIqWmJqSj3uEbnOGeG10WlhMSi4uPklLV1pbWF1UZGFkaWxsdICmoKKgnKOenJyepKqvtLi+vsC6sKafmJCOjIiGiop+fHuAjoyaoqOoqqyvqJ6fkoiHjY5+g46SfYKMlIeKioSQlY58cGhkZGNqZGpYTElGLjhKSlRbWE9VW2JsaG9xdHyDpaCboKKfnJqcnKKoqq61ury3rqyyqpeSjoqGhoaCfn+Cho6MmJyjqauqr7CuqaSUhnt8gXmOjn58hpWHcIF6hpOQlJCKgmt0XlZQWFtGQDArPkhMVVBOWV5qbnh0eXh9epqdmJ6enJuampuepKassbKytK2pop6XlI6Mi4qGgIKKjJCWnJaipKiprKuvsp6inIN9fnRyfoF+bnqEiX51cIKOf36Eg4mBcXJwbFdDVUQuLipCREhOVFdXZnJ2dGxucHCUlpyfnJqYmZmcnqCkp6ywsre4uaalopmSjoyMi4OJjJGVm6CamKKmqKuiqq6qmZKSk4J+bnB9gmxzhIZ5aX6ChXh+f3V4foR2emdkT0I7SDArMEBGUE5UWWdoamlmaGpslpWXnJyYlpeaoKGjpKywtra2ubKppqKakZCOi4eIjZGYmp+io6KYmqKinKSjrqyjlp2GhnVwam5oeIV+dXBseId6anRobG57cG90cFpWV0A2MSosQkhSVWBoYmdgZGZoapOWmZeWlpaYmpygoqausre6uLi0qKKdmJWSjo6Ki5GUmKGipammoJaSmpiWoqqmq5eUjoyKgXBiaG52doFzXHB6fnZ1XGRwfXReZXBxalhgRD0oJzpMTFhfal5cYGJlaGqUmJiUlZWWl5qfqKissLK2uLq4vLKkoJqWlZKYkIyUmZ6kqKyvrKWelo6Okpybmp2glIt8iIB6dF5gam52cFZwcnJ2fmpWXG5rbF5rb25tVEY0LCY0SVFZZFdYV1xgZW5vkpKRkpaYmpiapaiurrCwtbm8vLy/sqWgmpiWlZqOlpqipqyxtLaqpp6RioiMlo6WmpaMgoZ2b21qYlpkaGhWbm1lcG5mXlFaalhaY3BvaldEOzQmMUJMTldRSVtfYnB6fpWOkJKYnJygpKaqrq6wsra5u768vb+/qKCal5KSkZicoKisr7C2tKymlYyGg4yHkI6SlpCOhoJ7eGdpVFxmUWZmXmFaXGBSUlxeVWJsWm5mTz06JCw1NT5MSFRacW5wanuNkJKVlp6hpKSnqqqvsbS4ury+wL7CxK6inpmXlJeYmqCorKeqrqysoJqQioF+gYeJiYyNkZGCfnx2cWRQUFFbVlJMUFBKTktUX0lMYlBiXFlCOiUnMEBER1JVYGxkZXBwjJaZl5ianaCipqirrrCyuLy+wMLCvr6yqJ6cmpianJ2cpKeipqmmpaiZkYqEf316gYWMgIaCfHxwZF5ZUFBMS0hGRERITEhCQEVCPFZUWU5WSjwiIi46Rk5WSExSUlRjbJSYmpyanJ6goqaqrbCxtrq+wMS/wriwrKainpyanqWknJygpKCmopqeoJiNiIJ+eHaAhXeGdXdsZF5aV1paWltWUk5QSEhMTEFAPFI3RE48TkZMLCAkMkJOUj5MT1hkXFaUlpyfnp6ipKmtrq62tri+wsXDvrexrqimoqGgnqKipp6YlpaWnJqUlpmakISCfnx2b3BvcG5qZF5YYmRoZF9jYV5hZGFiWlBZUlA8Mi4vLTdGRkAgISAkMyhGTFhWTlJilpieoKKhqqyus7S0trm8wMXHyMa+tK6qqKWkoqCioqCamJaUjpCQjIyMjoyDfXp4dHFvamZoYGBcZmZmamZnbGhpZG9wbnBSW2RMXE5QUEgzKyYmIh8pIxw8SU5ISUxKVJycpaispaivsrS2uLq9wMLHyM7Kwr6wqqiopqWjop+cnJiWko6KjIeIhoiEgH16eHRwbHBuZmxxbmxqa25yanl0cXZqfnduUGRsUmhaXVJNTUZAODw4KCYjJTRDRElPUF6ioqaprKyrrLK2u7y+wMTHyczOysK+uKypq6inpqSooaSknJiYjIiGhIWEgnx8eHZ5eXh4eHh2dG1qbnB0fHJ+eXZ/b3eDcmtqbWBvbV5iZ1JQSkZERD4tIRo2QEJQXlxspKakqKmusK2utbvAwcTIys7Oysa/uLS8xa+tqqusrqesr6ilnZSMiIaCgIJ9fICHgYWKfIaAgnt8bHR1gIlufIJ6foGEhmR4dHZkbHJ4bGpoZVhSUUQ6MiEcGEBISkpYZKWoqqmprLGysbK3ur7EyMvNy8jCw8S5vsi6sK+srayorrKvopiSjIuQiIqKgoSKkouUiIaOiIeCgHJ2eoKLdoCMgoOGhoZ4gn1+fHx4d3BybGdYTkM3LkQ2HhopK0JQXGyhpKerrLCxtLa4vL6/xMbM0NPOxsrMwMLIwby0srSyrrGupqCanJ6UloyNjIaIkpqakpKQnJiLjI5yfH6IkHyCjoqOiouLioiCgHZ6eGxsYV1YUERKSEVAPCYaGERIWV5uo6SkqKuus7W4vr/BxMbIztLW1M/MzsbKzszCvrW6urSyqKKenqCoppySkY6KjpSbnJeWmZ2YkJWIdX2Ai46Dh46Ujo2IiISCgH5zcGpmYFxWUFBRUFROPTo0FRg4QkxaZ6Ckpqywsra6vMDFyMjLztDY2NrT0s7IzNTWy8S7ur+5raqoo6KmqKigmZKOjpSYnJ+cnZ6foJqUhH56h5KSho2SlZCKhoSAfHp1cm9pYmRiZ2xoZl5YTjw5NiMYIjZIV2akqK+us7q6u8DDwsfM0NDU2Nve2tjT0NTa1tLOzMO+trC7sayopqSdnJqSkJOUlp2enKKhoJ6WioCCgI2Yj5KSm5WPjYyIgX16dXB1cXt2YHFxb2NaVlVGOjYoFxRDUkpdoqittra7vcDAw77CxM3N0djc3d/Y2djY1MzM08zIwLq8vrauqKCemJaUkpSYl5menp6ioJ+im42GhouSlJeSmZqXkI+KhoSIgHt2fHh9eHN4al1WUEVKRDc0LhYRNEFLWKirq7S8vr/AwL65vMTGzMzX2tTa1NnMvsHBvsW+w8bCzMTCvKiinJyUlJKYmJmcnp2ioqaimpOKioiVlJaYmpqampiPi4qMhoiBgIKAgHp6cmxdRElKOzcyMi4cEyQ9RlalrrS4vMC8vLe0v8DEz9TW2dzSxsbMzLazsbK8urq8tLy6tLSrnp6Yl5iamJymoqCopKSeopqWjoyQlZSWlJaYmJuWkI6NjIyKhoSHhIR+fm9cTk1ANi4vLjExJBIQOkROsLC2ura3sq6wtsDDyc3W2dzaz8W6tb6+s6qorq+ouq6oqKSgqKCempyhrqaepqinpqKdnJiUkI6YmpaXlpKSkI2OkpGQjoiEgXyAgHx8fnhoX1RQTE9HQzonMCgeETNATa6ytLiyrKmttMDByMrW1tTY0Mi+sqqqsbSsnqakoKSkn6Celpagopqgnqiwoqmpp6Wgn6CamJOalpyemZqWkIqHhIqJiouGf3hucHhwanhsdGZgZl5YVEIvMCUsHhMSOUyoqq+yqqOntrzEyMrSz87O1M66uLKrn6Swppyao5uinpWVmJKQmJ6coKCoqqmoqKimoKSknp6bnpiYnKCbl5KMhn5/goWEhoB+fnhcYmB2VnNwbm5aaVpIOkAyFx8SCzZHnqKpqJ+fqbi5vL7Gy8fI0NLEs6iqrKSaoaaYlJaUoZiPkJKMjJaZnqKkqK6wr7GwqKaopKShnqSjoJugnpeQiYaGeHmFfIKCfnZqaFJUWlJsaG5uVlBaWVREOS8eHQw0PJqioKCbnKi0sLLAxcS/y83RvKyiqJ6gkpKUkpCKkJGQioyQioqMjZicnqyqrrS2sq6trqaio6OrqKaemJ6emY+QiIRyeHSCiH92cFRKRUpWWFZjWFpGSk5SRDAsEB0MHRSQlJSWmJmkqKiyucC8wMzOysy6rpyYlJKJipCKiIqIioaEioSGioqPkZWdnqGsqLi0trOoq6isqqueoYSajZmSjYmEfmtue393fnlwZllCRj5DWU5ISjo+OkpANhENCggWlpiYmZianKCjrLC6trzCxsTMuq6qmZCKiIaDhISKhoSEgIB/goaMjY6OkJeVmJ2lsri1r7SurKyolo6EiIiGloqEhoBwX2JpYHN0aWRkU0gzPkRYOEJCMDw9My0rLBcHCpeampueoKKgoaSorLKzt7rBxrCopaCakIaEgn6AgImCgYR9fIKEiIqLjI2Sk52joqiosLO8urKwqpqjloN6gnmIfH+CdmZbY1Rsc3ZgWVhORy42OkgvODMwKiseDBIOCgWenp6fqLCtrq6oqKqstL7AxMStrqKUkJGMhIB/enx/hH6BfHx+gIaIjYuLjpqgnpidnp+ktLy5s56cin6QenBwh4p7ZmVrX1hSZXBgYk5LVlxHLik3OC4wLicUGDA7NBcIoqCgoqiutrm2tLa6trK7w8q9taaVlI6IioKAfnt4eXx8enx4fISCgoiIjJCTnJ6YmJ2Wm56upq2mp6CWjH5yZGp1eHBuWlJaVl9gYGBgWDZIQEA5MC4vJR8TKyQ0QD4vFKqlpKOmqrS5vru6vsO3ur7EvqiglZWOioSAfn56d3Z4fnh4eXqCgoKDiIyQk5qakp+ekqKqrqaipo+JjpZ7iGpfbmxwdHJkXlBHYGZIWlpIOzA5My4mGBYcMEEySEQsLjizr6impqiutri+xMbHvsLCysWzrK6glIyEgX58end2c3l4dnZ4fn19goyOkJOWl5Cem5aTnKmqoJSgl3aGkIp6b1tWXF5yYFtRP0pcXUBOOD84KCIcJC8yLStGT0pCNj84uLKsrqqoqayytr3EysjCwcbFq7CqnJGIhIB9enh2cnJydnNyeXx7eoWOjo6UmJqQnpCMmqSmm6CMkJB6cIaIfmxzZlNdYHRxalY5PkhFNEQ6KCElMD0qRz4+RkhAOkFKOrq3srOvrKust7y8wsjMxsfIxLKno5uSjIaAfHl4eHRvcHJwdnp6enqFiIyNkJaSipSOg5Cfp5OgjHqSjYJtdIiGgnRqUF5mamhZUEMyRkc4JSdCMkFSNDRUQU5KRktNTEa5v7q5trK4sLS+w8LEysbGyMa6sqiqnI6Df3p4dnR0cGxwbnZ6enZ4hIyHipGUjoSTi36MnJ6ToJ6Db4p2bHR5fnN4ZVJITFBgW0xNQy40KjBITDw4VEZMT1RZUE1STko8try+vry8vryyucDIyM3GtrjCuL2ysJyRlIZ+eHRwcm5vampygHpyeIaHgIiRlIiAi4p7iZmSjpCYknt+jHpgZHZrcGxuZFFAVFRIQjI3Kj5COFNIXlRaYGVlYmJWUEdAQLu8wcTCwMDBuLi8wsfHxLaturCxtKOYjIeDfnp2cm9vamtpbXp0bnqFgHyHk5SGfIKEeICHmJR4gIh+YoKCdlZwam9aZGNZSDtMPjQ4L0Y8TlxcbmtuZl5gYF5iWE5PTU7AwMXEwMK9vMC+wMHCv8W2pqipoqOYkIyCfXx6eHVycHBpZmhscGx0fH16hIqKhHh5fXN2f4aOknR4hXNhgHZqUGRQYk5eVFZKNzZFQUpQTT1KYmppbmVYU1tUWl5cVFRTvr69vre7uLO5vru6wLy9uK2dpJqeloiEgn58end1dHBsbGpmZmZnbHpzeH6Gf351cndwcnh4gJCEcmpsZGxkZmRTVlNUTkY7Oj5EUktUWU5XUGJoYGBiYU9UTFRSVGBaWbm8u7ausbCts7q4tb65rq+om5STk5iJgYCAfoWAenRzcHB2dGZkZGRqbXaDhHtzcG1ubmpwbnyEioKAY2ReVVFNTUhERk5LU2BNSFhcXl1iXGhwa2FYVFNSREZMRlJTWEKytLa0qqmsqrC0sq60rauhn5yRjYyNkIJ8ent8eXh2dHN1d3hyaWNiZGhteXl4b2xqaGpnaGlsdHl8eXF6cV9wXmBVYFZeYFxYR0hiYl5iaHh4dHVwZFpSS0o6OzhKQE9IrrC0sqqmp6WtsKyoqaGenJiUj4qGhoyIfXp2eHd4ent+eHh5dnVuYF9kbHBvdm5oZmZnZmRkZGpsb3ZydG5sdGxrWmR2YmVrTlhMXmtzdHZ8dm1qbWxjYFhMUD0wOkJGQKisrK2qoqKhqKykoqCampaUlIyKhIKCiYB6dnZ4c3h8f4CCgn19eGdeXl5oZ2poZGNiZGRiYmFjYmVsaGZyb4Jtd2hYa3pmVlJmbF5rgIB0fnxyblVlYWJhXExOQTQpNUKmp6iopJ6cnaKhnpmYko+Ojo2LhoSBf36BeHZ2cnZ4en6BhIWCenJwbmBcXF9kYmJdX2RgX2BeXFpaXGBfbHKAg4JuZnB6ak5hdl5qgnZ6bnVreHJoUlRcXmBeXFBHMi4vo6SmpKCcmJifmpiUko+KiYqIhoOAf359enx4dnZ2en2BgIWNiYB1bWhgXFtaXF5eXV1eXF5eXVxaWFhaWmlye31+a252ZlRZZmhcfnhwZWdkXmtybmJRSllgU0hSRD40KqGkoqSemJeUk5Kol46MjIWDgYSAfnx7e3p4eHR2enp+gYSEiYJ8fnZuZF5ZWVdYWVpaW1tbWlpbWlpUVFVganJ+goJxcmZ6VmBuY4R2cG5bUlJUWFZSXEpGVFI8TDwuJiqipqOemJWSkI6QkZKQjoeCgXx7fHp4eHh4eHR3eHh6gIOFhoiJhoWAdG5iXVZXV1hWV1hYWFpYVlZaVFJTWmBleoCEi3R7bGxkdnqMhHt2dGRWTFRTV1FTSDZDQjYyJDMyoqGgnJiUko6MjI+UmIiDgYB/eXhzdnZ0dnZ1eHp7fYGBhIaKioqGenVqY15ZWFZWVlRWVldWVlVWV1NRVVlcZ3Z9foaKe2xrdYaGi3hqal9SUFZJPjo7QEFBOioqNTJCRqCemJaWkZCMiYeKjoyGf3p6gnp2dHV0dHN0dHZ8fH6AhIaIiIqOioKCcWxgWlZVVFRUVFJUVFRUVFJQUlRXXGdqbHCEiY6FiIyOinp4eHx3dGJKWFJWTkRCNS4qMjlMREucmJiTkpCLioaEhIaIhHx6eHp5eHJycnF0cnN0e3x+goaChIiKi46QioBybmRaVFNSUlFSUlJSVFJSUFRTVlpiY2VudnyEgn6Ch46JioR9cFhTT3FzWV9hWVI8Ok87VEZWmpaVkIyKioaGgH9+fHt5eHd4eHZycG1ydHp0cnp+f32CgIKIi46JjJSEe3BkWlRSUFBQTlBRUFJSUlJSVlpcXmBlbG9xe3p2foOQjnhsbFpYa2h0dGpiWlZKNlJQVlteVZSSkYyMiIaDgn5+fHh3dnh2dHd0c3FwbnBwcnB2fH56fnyEiYaOhoiMhn5zZl5WUFFQUVBLT1BQTlFVVVhaXV9iaGxqbnRwc32JjpCIfHZkboJycl5YUkw8SDhSV2NeVlSMioqIh4SEgoCAfH55dXZzc3JxcnFub2xrbnNub3qAfnd6gYqHgX+AgIB6cGJsXFNOUE9OTk5OUFJUVlZYWl1iZWhpa3JubG95foaQknqBZYCBgmtSTGRgRFReXmpiSEhEiIaEhIKEhIOAgHx7fHZ0cXBwb3BubmxqcHRxbGx2fndyfICDhoBzcnhzdXZhXGJYUE5OTk1MTFBSVFZZWFtcYWVmaGlsamtudHyGkJWCjHaOf3BcZ3lqXEJUZ25tYFleVoaCgX9/foKCgX16enh2dnRxcG1ubGtqaGtwcGlqdHd4bnJ+hoqEeGpqZmhyaFlbXFBOTE1MTExNUVVWW1pbXmJlZmhqaGlpanF6gIuSlJCOjIBqWm96ZltYanF1cmpoWUyEgH5+fHuBgIB+fnl6dnV0cnJwbWloZ2dmaHNqanB2cmpqdnx+fnRqZF9gZmZWVWJYU1NMTExMTVBSVlhYWltiZGdoaGhoaGhrdH6GjpealZyHdHyGclRuTml3al1eVkxEhIB+fHp6fn6EfXx8eXd2c3R0c3BsamhoZmRkZmRodHJmY2xydnhzamJcWllYUlJXXlZRTExMTExOT1JUVlheY2RmZmdmZ2loanB3fYqQjpeXjm2Sgml4emh0enJwWkhQYIB+fHt4e3x8gnp6enp4d3VycnRybm1ubmxqZGBiYGRmY2BkbGlta25kWlVSVE5NTlhQTUxMTExMTU9RVFhaXmNkZGRmZmRoaWtzen6CiIqGk4yCmoJ6f3qGfl5YT1dNZl2Afnp6enh6fHx3dnRzcnZ2dnR2c3JwdHBzdHBwYF1cXV5bXGFgW1lcXFZUUkxMTExNTUxMTExMTExMUFRYXmBjZmRiY2VkZ2hsc319f4KCgoCLgo2Ne3WViHxycGJ0XG9Wfnp4eHZ4enx6dnNycnZ0d3h3dHR0cnR2enh0b2heXFlYWllZWFZUVFNcV1FNTExMTExMTExMTExMTU9SWF5eX2JkYmJjZGRobnh+dnd4foB0e3SOjJOOlJaEd39neXhibXt4eXZ4cnR4eHZ3cnZ1dnh4fXp4dHR0enp6fHd0aF5aWFhXVlRSU1JQUVBMTExMTExMTExMTExMTE1TVlhcXmBfYmJiYmJjZnB1enJxdHp8emlsd3aMeoOMfJGKdIKGfoB6eHRzdHJzdnZ4eXp8enqAfIB/fHh2d3l6enh6dm5iXVlUVVZVVFJSUE5MTUxMTExMTExMTExMTExMVFZWWl5gYGBfYGJhYmhqcHJtbnJ1en92ZWZ0fHt8gHB1hoJ4fGyEeHRycnFwcXR1d3h+gHx8fH+BgIB9eHh4eHh4b25oYmBaVlZUVVNUUlJOUE1MTExMTExNTUxMTExMTFBUVlxgYl5eX19gYWRmZ2psbG5zdHh9dm5pY2RwZmpkiIxsZFp2cnVxcnFycnFzdHV6eXt6enx/gHx8enp6eHJwbWlkYFpYVlRUU1NUU1BPUk5PTE5NTExNTU5MTExMTExOUlRYYF5cXl5eXl9mZmhpamxsbXF4fHp0bWpXYG9menB0dGpMamN0cnJyc3BycnR4eHl5enyAg4B+fHp7enl6dGxnY15bWFZTUlRSUlJSUlJUU1JSUE5QUFBQTU1MTExMUE1VXGBeXFxaXF5eZGRoaGlqbHJwc3p6cG5qZlZWTmxYdGZdUllmc3NycnJycnN0eHp8fn6ChISEgn58fHh7fHVxbmpiXlhUVFJTU1RVVFRUUlRWVFRQU1BSUVJQTU1OTU5NUlZgW1taWlxcXmRjZmZoZmhqanByeHh4cmplXkpeXG5QYmBCXHR0cnR0c3N2d3l8foGCiImGjoqEgHx8fnt4dnpwZ19bWFdYWFRUU1RWVlVUVFNSU1hTWFJVWFJPUFBRUVJWVFpZWFpaWmNjYmZkZGZoaWxucnh6c3BsZV9bVkpQUFBRQEB1dXR1dnV2eHh7fH6Aho2OjpSSi4KBfnx8en+CgHBjYl5cW1lYVlZVVVVVVVRTVFFUVFJUVFJSUFJQUlRUVlRXWFZXWFxgYmJkY2RmZmhqbXB2fHh2bmpgXFhGRjo/PExEdnZ2dnd2dnl6fHx/goiVqayUlZaIg4KAg4aIh390amZkZF9cWFhbVlVWVFRUVFRUVFRTU1JTUVBRUVFSUlNTVFZYV1hYXmBhYmNkZGZobHBwb3l+eXRsZGBYWEhOQ0c9MHd3eHh4eHl6fHx/gIKGjqepnY+KioaEhoeMhoF4cmplZGBfW1laVlZWVVRUVFRSVFRVVFJUU1FSUlJSU1RUU1RWV1dYWGBgYGBhYmVwcHRsanByeH10cGxkXFhUVExOSUR4eHp4eHl7fHp+foKEgoiaqKeakYqKiomKjYyAfnpya2RkYmZcWFZWVlZTVFRUVFRUVFVUVFRTUlJSUlNSUlRVVVZWV1lcXl5fYGBlcXByamxsbXJ+dm5lZGBcWE5aUlBNenp6enp7e3x+gICAgoSDjpiioaKSioqMjY+LhoqGe3RsaGxuZlpYVlZWVFRSUlRUVVZVVlRUU1NUUlNTU1JUVVRUVldZWlteXl9gYmpqbGpqbGxwcm9saGZkZFlgXlhUTnx8e3t6fHt8foCCgoKDg4iMkpahnomJh42KioiKhoF2bnB4gGxcVlRXVlVVVFRSVlZYVlRVVVRWVVRUVFNSU1NUVFRXWFpbXF1eYGFja2hpaWprcHRzbmxsbmdiYGZcXFJ6e3x6fHp+gH+CgoOFhoSHiIyPkpqQioGAgIB9gIR+dHB2fIFxYFhXVlVWVFZUVVVWWFhWVlZVVlhUVVRSU1NUVFRWVVhXWlpcYF9gYWZoZmpoaWtzcnBycHJraGZsZmBVe3x8fH1+foCEgoKEhISHhYiIjo2QkIx/ent3d3l7dXR0eoSBcWFaWlhcXVhXVVZWVlZWVlZYVlVUVFRUU1NSUlNSVFZWV1hYWlxeX2JkZmZmaGlsbnR2dnhubnBscGpgW3x7fIB9gH5/goKCgoSGhoaHi4qNj5COhXx4dHJwcXRwb3Z5cmZeXFpoaWRYVlZWV1ZWV1dWVlVUVFRUVVJRUFFSUlJTVFVWWFpdXmBiYmZmZGZnaHJzdHt7cnN0d2xrYlh/fHx+gH+AgICCgIKEhoSEhoeIkJCSkoqAgHRwbmxtampubmliXl5cbGxqXFpaV1hXWFhZVldXVlZVU1VSUlBRUFBRUlJUVFZXWFxfYGBiY2RlaGhsb3J8gnh3fHRsaF9kenx+fH5+fX6CgIKCgoWGg4iIioqMkpOOhHx1cGxqZ2hoaWZlX15fXGB4cGJdYlpaXmBoZFdWWlhVVFJSUFBQUFBQUFBRUFJUVFdaXF5gYmJkZGdoam90g4aGgYN6cGpqcH59fn5+f36AgIKAgIKCg4aGhYiKjJCUkIN8eHJqamZkZGZlZmJgYF5fcG50ZGdeXmhobnBeWFpbXFRRUFFPTVBQUFBRUFBQUlRWWVtdXl9iZGRmaGxydnZ+g4J+fnh2c3Z8fHx9f35+gICAgICAgYOGiISEhoiOkIyDfXdwamhqZWRkZGRkZGJfXWxoanZiam1qbGpkYlpaWl1YUlJRUE5OTlBSTVBQTlBTVFdaXFxeYmRkZGhqbnBzdn6Ef3l6enl5fHx8fn5+gIB+gICAgICEhIKCgoSEjI+QgHp6cGtqamplZGRkZGNiYWBkZWZoZmxobGpsZGBdWlpaW1dUUk9OTkxMTk5OTlBPUVNWVlhaXF9gY2ZnbG9xcnx+gX95bHJ2c3x7en18gICBgIB+f3+AgH+AgICChoyQiHx2cm5qamppaGVkZGRkZWZmZGRmZWRmZWZlamdcXFtaWVhXV1dOTkxLSkxMTE1OTlBRUlZXWFtdYGRlZmptb3J6fX6Ad3BqbWp6fHt8fH6AgH9+fn5+gIJ/fn+AgYaIjYV7dm5tbGpqamdoZmVmZmZmZWZlZmRlZWRjY2NmXFtaWVhWVldVUk5MTUpISkpMTk1NT1BVVlhaXGBjZmdqbHBxeHp3eHJpZGFgenx6ent+fYCAfn1+fnx+fn5+fn6ChYJ9dG5ubGxsamtpaGhmZWZmZmVlZmVkZGRkZWRiYGBcW1pYV1ZVUlJQUE9LSkpISktLTExRUlRWWF1gZGRobGx4eHx9eHJtaGReWA==';
  let elevationBytes;
  function elevation(lon, lat) {
    if (lon < 109 || lon > 111 || lat < 38 || lat > 40) return null;
    const tx = ((lon + 180) / 360 * 2048 - 1647) * 256 - 0.5;
    const ty = ((1 - Math.asinh(Math.tan(lat * DEG)) / Math.PI) * 1024 - 779) * 256 - 0.5;
    if (tx < 0 || tx > 1023 || ty < 0 || ty > 1023) return null;
    elevationBytes ||= Uint8Array.from(atob(DEM_BYTES), c => c.charCodeAt(0));
    const u = tx / 1023 * 96, v = ty / 1023 * 96, i = Math.min(95, Math.floor(u)), j = Math.min(95, Math.floor(v));
    const a = u - i, b = v - j, k = 97 * j + i;
    return 1070 + 2 * ((1 - b) * ((1 - a) * elevationBytes[k] + a * elevationBytes[k + 1]) + b * ((1 - a) * elevationBytes[k + 97] + a * elevationBytes[k + 98]));
  }
  function coordinates(origin, lon, lat) {
    const phi = lat * DEG, delta = (lon - origin.lon) * DEG, sin = Math.sin(phi), cos = Math.cos(phi);
    const e = cos * Math.sin(delta), n = origin.cos * sin - origin.sin * cos * Math.cos(delta);
    const size = Math.hypot(e, n), dot = origin.sin * sin + origin.cos * cos * Math.cos(delta);
    const km = size ? EARTH * Math.atan2(size, dot) / size : EARTH;
    return [e * km, n * km];
  }
  const styles = {
    wood: ['#254442'], grass: ['#25413c'], built: ['#304750'], industrial: ['#324957'], quarry: ['#39494b'], water: ['#226272'],
    plant: ['#69563c'], substation: ['#8b6339'], river: [null, '#457f88', 1.1], service: [null, '#3e535c', 0.48],
    road: [null, '#53646c', 0.65], rail: [null, '#72808a', 0.75], mainroad: [null, '#78818a', 1.05],
    highway: [null, '#7a8183', 1.16], motorway: [null, '#859294', 1.28], line: [null, '#c99950', 1.25]
  };
  function mount(container, options = {}) {
    const frame = document.createElement('div');
    frame.style.cssText = 'position:relative;width:100%;height:100%;min-height:0;overflow:hidden;background:#0c1726;color:#dce8ee';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline-offset:-3px';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '区域电网三维地图，可拖动旋转、滚轮缩放。方向键旋转，Enter 依次选择变电站，Home 复位。');
    const status = document.createElement('div');
    status.setAttribute('role', 'status');
    status.style.cssText = 'position:absolute;top:12px;left:14px;right:55px;pointer-events:none;font:500 11px/1.4 system-ui,"PingFang SC",sans-serif;color:#aebdc9;text-shadow:0 1px 4px #071423';
    const credits = document.createElement('div');
    credits.style.cssText = 'position:absolute;bottom:6px;left:14px;right:53px;pointer-events:none;font:500 9px/1.4 system-ui,sans-serif;color:#91a7b4;text-shadow:0 1px 3px #061220';
    function credit(label, url) {
      const a = document.createElement('a'); a.textContent = label; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.style.cssText = 'color:inherit;text-decoration:underline;pointer-events:auto'; return a;
    }
    frame.append(canvas, status, credits); container.append(frame);
    const ctx = canvas.getContext('2d'), pointers = new Map();
    let latlon, key = '', controller, destroyed = false, selected, result, ranked = [], pins = [], half = 15;
    let angle = INITIAL_ANGLE, tilt = INITIAL_TILT, zoom = 1, w = 0, h = 0, pixelRatio = 1, nextPaint, background;
    let local = false, partialLocal = false, mesh = [], contours = [], groundByType = new Map(), villages = [], hit = [], start, dragged, multi;
    const signal = new AbortController(), events = {signal:signal.signal};
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const goal = {angle:INITIAL_ANGLE,tilt:INITIAL_TILT,zoom:1,east:0,north:0};
    let east=0,north=0,playing=true,inView=true,lastFrame=0,sceneTime=0,pinsAt=-1000,selectionAt=-1000,hovered;
    let texture, patches, surfaceEdge, reliefImage, textureVersion=0, frameDt=16;
    const labelOffsets=new Map();
    const relief=new Image();
    relief.onload=()=>{
      // Restore tonal separation to the low-key cartographic hillshade before draping it over the DEM.
      const im=document.createElement('canvas');im.width=relief.naturalWidth;im.height=relief.naturalHeight;
      const ic=im.getContext('2d',{willReadFrequently:true});ic.drawImage(relief,0,0);
      try{
        const pixels=ic.getImageData(0,0,im.width,im.height),rgba=pixels.data;
        for(let i=0;i<rgba.length;i+=4){const t=rgba[i+1]-38;rgba[i]=39+t*2.7;rgba[i+1]=65+t*3.2;rgba[i+2]=72+t*3.1;}
        ic.putImageData(pixels,0,0);reliefImage=im;
      }catch{reliefImage=relief;} // File previews may disallow pixel readback.
      if(!destroyed && local){buildTexture();background=null;repaint();}
    };
    relief.src=reliefUrl.href;
    function animated(){return playing && !motion.matches;}
    function changeMotion(){if(!animated())selectionAt=pinsAt=sceneTime-1100;lastFrame=0;repaint();}
    function setPlaying(value){if(playing===Boolean(value))return;playing=Boolean(value);changeMotion();}
    motion.addEventListener('change',changeMotion,events);
    document.addEventListener('visibilitychange',()=>{lastFrame=0;repaint();},events);
    function surface(x, n) {
      if (!local) return 0;
      const m = elevation(latlon.lon + x / (111.195 * latlon.cos), latlon.lat + n / 111.195);
      return m === null ? 0 : (m - latlon.datum) * 0.006;
    }
    function world(x,n) { return [x,n,surface(x,n)]; }
    function camera() {
      const c = Math.cos(angle), s = Math.sin(angle), ct = Math.cos(tilt), st = Math.sin(tilt);
      const px = Math.min(w * 0.86 / (2 * half * 1.35), h * 0.72 / (2 * half * 1.35 * Math.sin(INITIAL_TILT))) * zoom;
      return {px,c,s,st,ct,project:([x,n,z=0]) => [w*.5+((x-east)*c-(n-north)*s)*px,h*.535-(((x-east)*s+(n-north)*c)*st+z*ct)*px]};
    }
    function rebuildGround() {
      if (!latlon) return;
      const data = window.GridMapData, dem = elevation(latlon.lon, latlon.lat), box = data?.bounds;
      const dlon = half / Math.max(0.001,111.195 * latlon.cos), dlat = half / 111.195;
      local = !!box && dem !== null && latlon.lon+dlon >= box[0] && latlon.lon-dlon <= box[2] && latlon.lat+dlat >= box[1] && latlon.lat-dlat <= box[3];
      partialLocal = local && (latlon.lon-dlon < box[0] || latlon.lon+dlon > box[2] || latlon.lat-dlat < box[1] || latlon.lat+dlat > box[3]);
      latlon.datum = dem ?? 0; groundByType = new Map(); villages = []; mesh = []; contours = [];
      if (local) {
        const dim = 42, step = 2 * half / dim, samples = [];
        for (let j = 0; j <= dim; j++) {
          samples[j] = [];
          for (let i = 0; i <= dim; i++) samples[j][i] = world(-half+i*step,-half+j*step);
        }
        for (let j = 0; j < dim; j++) for (let i = 0; i < dim; i++) {
          const a=samples[j][i], b=samples[j][i+1], c=samples[j+1][i+1], d=samples[j+1][i];
          const light = clamp(((a[2]+d[2]-b[2]-c[2])*0.39+(a[2]+b[2]-c[2]-d[2])*0.19)/step,-0.6,0.6);
          const tint = Math.round(62 * light), high = Math.round(clamp((a[2]+b[2]+c[2]+d[2])*2,-8,8));
          // Intersect each measured terrain cell with 25 m contour planes.
          const corners=[a,b,c,d], meters=corners.map(p=>latlon.datum+p[2]/.006);
          for(let level=Math.ceil(Math.min(...meters)/25)*25;level<Math.max(...meters);level+=25){
            const cuts=[];
            for(let k=0;k<4;k++){
              const k2=(k+1)%4, m0=meters[k], m1=meters[k2];
              if((m0<level)===(m1<level))continue;
              const t=(level-m0)/(m1-m0), start=corners[k],end=corners[k2];
              cuts.push([start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*t,(level-latlon.datum)*.006]);
            }
            for(let k=1;k<cuts.length;k+=2)contours.push([cuts[k-1],cuts[k],level%100===0]);
          }
          mesh.push({points:[a,b,c,d], color:`rgb(${32+tint+high} ${57+tint+high} ${63+tint})`});
        }
        for(const [type,,name,detail,raw] of data.features) {
          if(!styles[type] || raw.length < 4) continue;
          const points=[];let xlo=Infinity,xhi=-Infinity,nlo=Infinity,nhi=-Infinity;
          for(let i=0;i+1<raw.length;i+=2) {
            const lon=data.origin[0]+raw[i]/data.scale, lat=data.origin[1]+raw[i+1]/data.scale;
            const [x,n]=coordinates(latlon,lon,lat);
            points.push([x,n,0]);xlo=Math.min(xlo,x);xhi=Math.max(xhi,x);nlo=Math.min(nlo,n);nhi=Math.max(nhi,n);
          }
          if(xlo>half || xhi< -half || nlo>half || nhi< -half) continue;
          for(const point of points)point[2]=surface(point[0],point[1]);
          if(!groundByType.has(type))groundByType.set(type,[]);
          groundByType.get(type).push({points,detail});
        }
        villages = data.places.map(([,name,x,n])=>({name,point:coordinates(latlon,data.origin[0]+x/data.scale,data.origin[1]+n/data.scale)})).filter(d=>d.point.every(v=>Math.abs(v)<half*.87));
      }
      surfaceEdge=outline(half);buildTexture();setCredits();background=null;
    }
    function setCredits(){
      credits.replaceChildren(credit('© OpenStreetMap','https://www.openstreetmap.org/copyright'));
      if(local)credits.append(' · ',credit('Mapzen 地形','https://registry.opendata.aws/terrain-tiles/'),'（高度 ×6）');
      if(!local || result?.scope === 'mixed' || result?.scope === 'global') credits.append(' · ',credit('OpenInfraMap','https://openinframap.org/'));
    }
    function path(points, project, close=false) {
      ctx.beginPath();
      points.forEach((p,i)=>{const [x,y]=project(p); if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
      if(close)ctx.closePath();
    }
    function outline(halfSize,heightOffset=0) {
      const pts=[], corners=[[-halfSize,-halfSize],[halfSize,-halfSize],[halfSize,halfSize],[-halfSize,halfSize]];
      const length=local?30:1;
      for(let j=0;j<4;j++) {
        const [a,b]=corners[j],[c,d]=corners[(j+1)%4];
        for(let i=0;i<length;i++){const t=i/length,x=a+(c-a)*t,n=b+(d-b)*t;pts.push([x,n,surface(x,n)+heightOffset]);}
      }
      return pts;
    }
    function buildTexture(){
      // The orthophoto-style plate uses a real elevation raster and the stored OSM vectors.
      // Draw map detail once, then transform small terrain facets with every camera movement.
      const size=1152;
      texture ||= document.createElement('canvas');texture.width=size;texture.height=size;
      const t=texture.getContext('2d'), xy=([x,n])=>[(x+half)*size/(2*half),(half-n)*size/(2*half)];
      const line=(points,closed=false)=>{
        t.beginPath();for(let i=0;i<points.length;i++){const [x,y]=xy(points[i]);if(i)t.lineTo(x,y);else t.moveTo(x,y);}if(closed)t.closePath();
      };
      t.fillStyle=local?'#233e48':'#172e40';t.fillRect(0,0,size,size);
      for(const cell of mesh){line(cell.points,true);t.fillStyle=cell.color;t.strokeStyle=cell.color;t.lineWidth=1.3;t.fill();t.stroke();}
      if(local && reliefImage){
        const lonX=lon=>((lon+180)/360*2048-1647)*256,latY=lat=>((1-Math.asinh(Math.tan(lat*DEG))/Math.PI)*1024-779)*256;
        const lonSpan=half/(111.195*latlon.cos),latSpan=half/111.195;
        const sx=lonX(latlon.lon-lonSpan),sw=lonX(latlon.lon+lonSpan)-sx;
        t.globalAlpha=.86;
        // Latitude bands preserve the source Web-Mercator sample spacing on the local north/east grid.
        for(let band=0;band<16;band++){
          const top=latY(latlon.lat+latSpan*(1-2*band/16)),bottom=latY(latlon.lat+latSpan*(1-2*(band+1)/16));
          t.drawImage(reliefImage,sx,top,sw,bottom-top,0,band*size/16,size,size/16);
        }
        t.globalAlpha=1;
      }
      const reliefLight=t.createLinearGradient(0,0,size,size);reliefLight.addColorStop(0,'rgba(129,179,171,.13)');reliefLight.addColorStop(.48,'rgba(40,74,82,.0)');reliefLight.addColorStop(1,'rgba(5,16,36,.25)');t.fillStyle=reliefLight;t.fillRect(0,0,size,size);
      for(const heavy of [false,true]){
        t.beginPath();for(const [a,b,index] of contours){if(heavy!==index)continue;t.moveTo(...xy(a));t.lineTo(...xy(b));}
        t.strokeStyle=heavy?'rgba(163,196,180,.34)':'rgba(148,176,165,.17)';t.lineWidth=heavy?1.65:.95;t.stroke();
      }
      for(const [type,[fill,stroke,width]] of Object.entries(styles)){
        const group=groundByType.get(type);if(!group)continue;
        t.lineJoin='round';t.lineCap='round';
        for(const feature of group){
          line(feature.points,!!fill);
          if(fill){t.globalAlpha=type==='water'?.90:.44;t.fillStyle=fill;t.fill();t.globalAlpha=1;continue;}
          if(!stroke)continue;
          const hv=type==='line'&&String(feature.detail).split(';').some(v=>Number(v)>=330000);
          const lineWidth=width*(hv?3.3:2.35);
          if(type==='line'||type==='motorway'||type==='highway'){
            t.strokeStyle=type==='line'?'rgba(70,44,26,.85)':'#263b45';t.lineWidth=lineWidth+2.5;t.stroke();
          }
          t.strokeStyle=type==='line'?(hv?'#ffe097':'#e5af65'):stroke;t.lineWidth=lineWidth;t.stroke();
        }
      }
      const step=[.025,.05,.1,.25,.5,1,2,5,10,20,50].find(k=>k>half/11) || 50;
      t.lineWidth=1.25;t.strokeStyle=local?'rgba(162,205,207,.18)':'rgba(130,191,207,.22)';t.beginPath();
      for(let k=Math.ceil(-half/step)*step;k<half;k+=step){const [x,y]=xy([k,k]);t.moveTo(x,0);t.lineTo(x,size);t.moveTo(0,y);t.lineTo(size,y);}t.stroke();
      const count=local?12:1, pts=[], st=size/count;
      for(let j=0;j<=count;j++){
        pts[j]=[];for(let i=0;i<=count;i++){const u=i/count,v=j/count;pts[j][i]=world(half*(u*2-1),half*(1-v*2));}
      }
      patches=[];
      for(let j=0;j<count;j++)for(let i=0;i<count;i++)patches.push({u:i*st,v:j*st,step:st,p:[pts[j][i],pts[j][i+1],pts[j+1][i],pts[j+1][i+1]]});
      textureVersion++;
    }
    function texturedSurface(cam){
      // Two affine triangles drape each raster cell onto its four measured elevations.
      for(const patch of patches){
        const [a,b,c,d]=patch.p.map(cam.project), {u,v,step}=patch;
        const triangle=(p0,p1,p2,tx,ty,reflect)=>{
          const dx=(p1[0]-p0[0])/step,dy=(p1[1]-p0[1])/step,ex=(p2[0]-p0[0])/step,ey=(p2[1]-p0[1])/step;
          const midX=(p0[0]+p1[0]+p2[0])/3,midY=(p0[1]+p1[1]+p2[1])/3;
          ctx.save();ctx.beginPath();
          [p0,p1,p2].forEach(([x,y],i)=>{const m=Math.hypot(x-midX,y-midY)||1,nx=x+.65*(x-midX)/m,ny=y+.65*(y-midY)/m;if(i)ctx.lineTo(nx,ny);else ctx.moveTo(nx,ny);});ctx.closePath();ctx.clip();
          const f=reflect?-1:1;
          ctx.transform(dx*f,dy*f,ex*f,ey*f,p0[0]-dx*f*tx-ex*f*ty,p0[1]-dy*f*tx-ey*f*ty);
          ctx.drawImage(texture,u,v,step,step,u,v,step,step);ctx.restore();
        };
        triangle(a,b,c,u,v,false);triangle(d,c,b,u+step,v+step,true);
      }
    }
    function drawGround(cam) {
      const {project}=cam, top=surfaceEdge, depth=half*.085;
      // Layered edge at actual mapped elevations; broad base remains readable edge-on.
      const toMatrix = p => [p[0],p[1],p[2]-depth];
      path(top.map(toMatrix),project,true);ctx.fillStyle='#101f2b';ctx.shadowBlur=22;ctx.shadowColor='#020810';ctx.shadowOffsetY=8;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
      const edges=[];
      for(let i=0;i<top.length;i++){
        const a=top[i],b=top[(i+1)%top.length]; edges.push({a,b,order:project(a)[1]+project(b)[1]});
      }
      edges.sort((a,b)=>a.order-b.order);
      for(const {a,b} of edges){
        const shade=(a[0]+b[0]) < 0 ? '#203846' : '#142b38';
        path([a,b,toMatrix(b),toMatrix(a)],project,true);ctx.fillStyle=shade;ctx.fill();
        path([toMatrix(a),toMatrix(b)],project);ctx.strokeStyle='#396475';ctx.lineWidth=1.35;ctx.stroke();
        path([[a[0],a[1],a[2]-depth*.74],[b[0],b[1],b[2]-depth*.74]],project);ctx.strokeStyle='rgba(93,147,158,.48)';ctx.lineWidth=.8;ctx.stroke();
      }
      path(top,project,true);ctx.fillStyle='#27404b';ctx.fill();ctx.save();ctx.clip();texturedSurface(cam);
      ctx.font=font(500,10);ctx.textAlign='center';ctx.fillStyle='#b6c6c8';
      for(const d of villages){const [x,y]=project(world(...d.point));ctx.strokeStyle='rgba(19,40,45,.8)';ctx.lineWidth=3;ctx.strokeText(d.name,x,y);ctx.fillText(d.name,x,y);}
      ctx.restore();path(top,project,true);ctx.strokeStyle='#507882';ctx.lineWidth=1;ctx.stroke();
    }
    function paintBase(cam) {
      const hash=[w,h,pixelRatio,angle,tilt,zoom,east,north,half,textureVersion].join(',');
      if(background?.hash === hash){ctx.drawImage(background.img,0,0,w,h);return;}
      ctx.fillStyle='#0c1726';ctx.fillRect(0,0,w,h);
      const glow=ctx.createRadialGradient(w*.5,h*.53,0,w*.5,h*.53,w*.58);glow.addColorStop(0,'#274451');glow.addColorStop(.60,'#142b38');glow.addColorStop(1,'#0c1726');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
      drawGround(cam);
      // Selection does not require reprojecting the regional extract.
      const img=background?.img??document.createElement('canvas');img.width=canvas.width;img.height=canvas.height;img.getContext('2d').drawImage(canvas,0,0);background={hash,img};
    }
    function selectionLine(cam){
      if(!selected)return;
      const pin=pins.find(p=>p.row.id===selected.id);if(!pin)return;
      const progress=animated()?clamp((sceneTime-selectionAt)/720,0,1):1;
      const reach=1-Math.pow(1-progress,2),[x,n]=pin.point,line=[];
      for(let i=0;i<=32;i++){const t=reach*i/32;line.push(world(x*t,n*t));}
      path(line,cam.project);ctx.strokeStyle='rgba(2,18,26,.88)';ctx.lineWidth=4;ctx.stroke();
      ctx.strokeStyle='#9cf3df';ctx.lineWidth=1.8;ctx.setLineDash([5,3]);ctx.stroke();ctx.setLineDash([]);
      if(progress<1){const [hx,hy]=cam.project(line.at(-1));ctx.fillStyle='#dcfff5';ctx.shadowBlur=9;ctx.shadowColor='#74f3cf';ctx.beginPath();ctx.arc(hx,hy,2.75,0,2*Math.PI);ctx.fill();ctx.shadowBlur=0;}
    }
    function siteModel(cam,center){
      const [ox,on,z]=center, unit=1/cam.px;
      const pos=(x,n,ht=0)=>cam.project([ox+x*unit,on+n*unit,z+ht*unit]);
      const face=(coords,fill,stroke)=>{ctx.beginPath();coords.forEach((p,i)=>{if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.lineWidth=.65;ctx.strokeStyle=stroke;ctx.stroke();}};
      face([pos(-14,-10),pos(17,-10),pos(17,12),pos(-14,12)],'rgba(5,15,21,.74)');
      face([pos(-16,-10,1),pos(15,-10,1),pos(15,11,1),pos(-16,11,1)],'#226064','#6bc1ad');
      const buildings=[[-12,-7,-2,7,7],[0,-7,10,7,5]];
      buildings.sort((a,b)=>(a[0]-b[0])*cam.s);
      for(const [x0,y0,x1,y1,height] of buildings){
        const corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],tops=corners.map(([x,y])=>pos(x,y,height));
        const sides=corners.map((p,i)=>({p,i,mid:pos(...p)[1]+pos(...corners[(i+1)%4])[1]})).sort((a,b)=>a.mid-b.mid);
        for(const {p,i} of sides){const j=(i+1)%4;face([pos(...p,1),pos(...corners[j],1),tops[j],tops[i]],i%2?'#39888b':'#255d6b','#577e87');}
        face(tops,'#a0d4c4','#cae8d9');
        for(let y=y0+3;y<y1;y+=4)face([pos(x0+2,y,height+.1),pos(x1-2,y,height+.1),pos(x1-2,y+1.8,height+.1),pos(x0+2,y+1.8,height+.1)],'#58888a');
      }
    }
    function pinGlyph(cam,point,isSite,active,hover,index){
      const [x,y]=cam.project(point),accent=isSite?'#73f3d8':active?'#ffe7a2':hover?'#ffd195':'#eab571';
      const pop=isSite||!animated()?1:clamp(.60+(sceneTime-pinsAt-(index||0)*20)/280,.57,1);
      const k=isSite?14:active?9:hover?8:6.2;
      if(isSite||active||hover){
        const halo=ctx.createRadialGradient(x,y,0,x,y,k*2.3);halo.addColorStop(0,isSite?'rgba(76,233,202,.34)':'rgba(244,176,83,.28)');halo.addColorStop(1,'rgba(65,152,141,0)');ctx.fillStyle=halo;ctx.beginPath();ctx.ellipse(x,y,k*2.3,k*1.2,0,0,Math.PI*2);ctx.fill();
      }
      if(isSite)siteModel(cam,point);
      ctx.globalAlpha=pop;ctx.strokeStyle=accent;ctx.lineWidth=active?1.65:1;ctx.beginPath();ctx.ellipse(x,y,k*1.28,k*.58,0,0,Math.PI*2);ctx.stroke();
      if(isSite && animated()){
        const phase=(sceneTime%3200)/3200;ctx.globalAlpha=.36*(1-phase);ctx.beginPath();ctx.ellipse(x,y,k*(1.2+phase),k*(.56+phase*.48),0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
      }
      const rise=(isSite?31:active?25:hover?22:16)*(.45+.55*pop);
      const stem=ctx.createLinearGradient(x,y,x,y-rise);stem.addColorStop(0,isSite?'rgba(72,206,183,.30)':'rgba(220,147,68,.24)');stem.addColorStop(1,accent);ctx.strokeStyle=stem;ctx.beginPath();ctx.moveTo(x,y-(isSite?6:1));ctx.lineTo(x,y-rise);ctx.stroke();
      const s=active||hover?4.6:3.6;ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(x,y-rise-s);ctx.lineTo(x+s,y-rise);ctx.lineTo(x,y-rise+s);ctx.lineTo(x-s,y-rise);ctx.closePath();ctx.shadowColor=accent;ctx.shadowBlur=isSite||active?8:3;ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;
      return {x,y:y-rise,baseY:y,pop};
    }
    function label(record, occupied) {
      const {x,y,site,active,pin}=record, rank=pin?.index;
      const station = pin?.row;
      const text = site?'场址 · 方案示意':(rank?cap(rank):'选中')+' '+(station.name || station.voltage || '变电站');
      const maxText=w<440?12:19, shown=text.length>maxText?text.slice(0,maxText-1)+'…':text;
      ctx.font=font(600,site?11:10);const width=Math.ceil(ctx.measureText(shown).width)+14,height=20;
      const right=x+10,left=x-10-width, mid=x-width*.5;
      const dirs=site?[[right,y-12],[left,y-10],[mid,y-30]]:[[right,y-12],[left,y-12],[mid,y-34],[right,y+7],[left,y+7],[mid,y+19]];
      let box;
      for(const [a,b] of dirs) {
        if(a<4 || a+width>w-4 || b<29 || b+height>h-39)continue;
        if(occupied.some(o=>a<o.x+o.w+3 && a+width>o.x-3 && b<o.y+o.h+2 && b+height>o.y-2))continue;
        box={x:a,y:b,w:width,h:height};break;
      }
      if(!box){if(!site&&!active)return;box={x:clamp(right,2,Math.max(2,w-width-2)),y:clamp(y-17,29,Math.max(29,h-55)),w:width,h:height};}
      occupied.push({...box});
      const labelKey=site?'site':station.id, prior=labelOffsets.get(labelKey), speed=animated()?1-Math.exp(-frameDt/58):1;
      const offsetX=box.x-x,offsetY=box.y-y;
      if(prior){box.x=x+prior[0]+(offsetX-prior[0])*speed;box.y=y+prior[1]+(offsetY-prior[1])*speed;}
      labelOffsets.set(labelKey,[box.x-x,box.y-y]);ctx.globalAlpha=record.pop;
      const color=site?'#76efdb':active?'#ffe599':'#f1c787', line=site?'#43897f':active?'#b99c5c':'#736247';
      ctx.strokeStyle=line;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(clamp(x,box.x,box.x+width),clamp(y,box.y,box.y+height));ctx.stroke();
      ctx.beginPath();ctx.roundRect(box.x,box.y,width,height,3);ctx.fillStyle=site?'#143e40':'#16242c';ctx.fill();ctx.stroke();
      ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(shown,box.x+7,box.y+height/2);ctx.textBaseline='alphabetic';
      ctx.globalAlpha=1;hit.push({box,row:station??null});
    }
    function markers(cam) {
      hit=[];
      const collection=pins.map(p=>({point:p.point,pin:p,site:false,active:p.row.id===selected?.id}));
      collection.push({point:world(0,0),site:true,active:false});
      collection.sort((a,b)=>cam.project(a.point)[1]-cam.project(b.point)[1]);
      for(const rec of collection){
        Object.assign(rec,pinGlyph(cam,rec.point,rec.site,rec.active,hovered!==undefined && (rec.site?hovered===null:hovered===rec.pin?.row.id),rec.pin?.index));
        hit.push({box:{x:rec.x-8,y:rec.y-7,w:16,h:rec.baseY-rec.y+14},row:rec.pin?.row??null});
      }
      const occupied=[];
      collection.sort((a,b)=>(Number(b.site)-Number(a.site))||(Number(b.active)-Number(a.active))||((a.pin?.index??0)-(b.pin?.index??0)));
      for(const r of collection)label(r,occupied);
    }
    function instruments(cam) {
      const cx=w-30,cy=36;
      const dx=-cam.s,dy=-cam.c*cam.st,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
      ctx.strokeStyle='#45636d';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(cx,cy,13,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#b2dcdd';ctx.beginPath();ctx.moveTo(cx+ux*13,cy+uy*13);ctx.lineTo(cx-ux*4-uy*3,cy-uy*4+ux*3);ctx.lineTo(cx-ux*4+uy*3,cy-uy*4-ux*3);ctx.closePath();ctx.fill();ctx.fillStyle='#b5d4d6';ctx.font=font(600,10,true);ctx.textAlign='center';ctx.fillText('N',cx,cy-18);
      const options=[.01,.025,.05,.1,.25,.5,1,2,5,10,20,50];const km=options.filter(v=>v*cam.px<=66).at(-1)||.01;
      const x=15,y=h-25,end=x+km*cam.px;ctx.strokeStyle='#acbfc5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-4);ctx.lineTo(x,y);ctx.lineTo(end,y);ctx.lineTo(end,y-4);ctx.stroke();
      ctx.textAlign='left';ctx.fillStyle='#adc2ca';ctx.font=font(500,9,true);ctx.fillText(km>=1?km+' km':(km*1000)+' m',end+6,y+2);
    }
    function render(now){
      nextPaint=undefined;if(destroyed||!ctx||!latlon||w<2||h<2||!inView||document.hidden)return;
      const run=animated(),dt=lastFrame?Math.min(120,now-lastFrame):16;
      const cameraMoving=Math.abs(goal.angle-angle)+Math.abs(goal.tilt-tilt)+Math.abs(goal.zoom-zoom)+(Math.abs(goal.east-east)+Math.abs(goal.north-north))/half>.0005;
      if(run&&lastFrame&&dt<(cameraMoving?16:32)){repaint();return;}
      lastFrame=now;frameDt=dt;if(run)sceneTime+=dt;
      const blend=run && cameraMoving?1-Math.exp(-dt/(pointers.size?48:96)):1;
      angle+=(goal.angle-angle)*blend;tilt+=(goal.tilt-tilt)*blend;zoom+=(goal.zoom-zoom)*blend;east+=(goal.east-east)*blend;north+=(goal.north-north)*blend;
      ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);const cam=camera();paintBase(cam);selectionLine(cam);markers(cam);instruments(cam);
      if(run)repaint();
    }
    function repaint(){if(!nextPaint&&!destroyed)nextPaint=requestAnimationFrame(render);}
    function resize(){
      const rect=frame.getBoundingClientRect(),dpi=Math.min(2,window.devicePixelRatio||1);
      const nw=Math.round(rect.width), nh=Math.round(rect.height);
      if(w!==nw||h!==nh||dpi!==pixelRatio){w=nw;h=nh;pixelRatio=dpi;canvas.width=Math.round(w*dpi);canvas.height=Math.round(h*dpi);background=null;}
      repaint();
    }
    function displayStatus(){
      const base=local?(partialLocal?'部分区域地形与线路':'区域地形与线路'):'站点坐标图 · 无区域地形与线路';
      let message;
      if(!result)message='正在查询 15 km 内变电站';
      else if(result.status==='unavailable')message='站点数据暂不可用';
      else if(result.status==='partial'||result.complete===false)message=`部分覆盖 · 已找到 ${result.totalMatched??ranked.length} 座`;
      else if(!ranked.length)message='15 km 范围内暂无已收录站点';
      else message=(ranked.length>MAX_PINS?'显示最近 '+MAX_PINS+' 座':'显示 '+ranked.length+' 座')+' · 15 km 查询半径';
      status.textContent=base+'　/　'+message+(selected?'　·　场址至选中站直线 '+shortDistance(selected.distanceKm):'');
    }
    function updatePins() {
      const display=ranked.slice(0,MAX_PINS);
      if(selected && !display.some(p=>p.id===selected.id))display.push(selected);
      pins=display.map(r=>{const [x,n]=coordinates(latlon,r.lon,r.lat);const idx=ranked.findIndex(p=>p.id===r.id);return {row:r,index:idx>=0?idx+1:null,point:world(x,n)};});
    }
    function updateExtent(){
      const near=ranked.slice(0,MAX_PINS);if(selected)near.push(selected);
      const extent=Math.max(0,...near.map(r=>r.distanceKm));
      const next=local || !extent ? Math.max(15,extent*1.1) : clamp(extent*1.35,.25,Math.max(16,extent*1.35));
      if(Math.abs(next-half)>.001){half=next;rebuildGround();}
      updatePins();
    }
    function receive(data){
      if(result!==data)pinsAt=sceneTime;result=data;ranked=(data.rows||[]).filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&Number.isFinite(r.distanceKm)).slice().sort((a,b)=>a.distanceKm-b.distanceKm||a.id.localeCompare(b.id));
      updateExtent();setCredits();displayStatus();repaint();
    }
    function query(){
      controller?.abort();controller=new AbortController();const guard=controller.signal, currentKey=key;
      const saved=cache.get(key);if(saved && Date.now()-saved.at<3600000){receive(saved.data);return;}
      Promise.resolve().then(()=>window.GridNearby.find(latlon.lat,latlon.lon,{radiusKm:RADIUS,limit:Number.MAX_SAFE_INTEGER,signal:guard})).then(data=>{
        if(guard.aborted||destroyed||currentKey!==key)return;
        if(data.complete){if(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(currentKey,{data,at:Date.now()});}receive(data);
      }).catch(()=>{if(!guard.aborted && !destroyed && currentKey===key)receive({status:'unavailable',rows:[]});});
    }
    function update({project,stations}={}) {
      const loc=project?.location;if(!loc||!Number.isFinite(loc.lat)||!Number.isFinite(loc.lon))return;
      const next=loc.lat+'/'+loc.lon;
      if(next===key){
        if(stations && result!==stations)receive(stations);
        else if(stations===null && result){selected=null;result=null;ranked=[];updateExtent();displayStatus();repaint();}
        resize();return;
      }
      controller?.abort();key=next;latlon={lat:loc.lat,lon:loc.lon,cos:Math.cos(loc.lat*DEG),sin:Math.sin(loc.lat*DEG)};
      selected=null;result=null;ranked=[];pins=[];half=RADIUS;angle=goal.angle=INITIAL_ANGLE;tilt=goal.tilt=INITIAL_TILT;zoom=goal.zoom=1;east=north=goal.east=goal.north=0;sceneTime=0;lastFrame=0;hovered=undefined;labelOffsets.clear();
      rebuildGround();displayStatus();resize();
      if(stations)receive(stations);else if(stations===undefined)query();
    }
    function focusStation(row) {
      if(!latlon)return;
      const previous=selected?.id;
      selected=row && Number.isFinite(row.lon) && Number.isFinite(row.lat) && Number.isFinite(row.distanceKm)?row:null;
      updateExtent();
      if(previous!==selected?.id){
        selectionAt=sceneTime;
        if(selected){
          const [x,n]=pins.find(d=>d.row.id===selected.id).point;
          goal.east=x*.39;goal.north=n*.39;
          goal.zoom=clamp(1.21-Math.min(.13,selected.distanceKm/half*.10),1.06,1.21);
        }else{goal.east=goal.north=0;goal.zoom=1;}
      }
      displayStatus();repaint();
    }
    function choose(row){focusStation(row);options.onSelect?.(row);}
    function zoomBy(factor){if(Number.isFinite(factor)&&factor>0){goal.zoom=clamp(goal.zoom*factor,.55,4);repaint();}}
    function reset(){goal.angle=angle+Math.atan2(Math.sin(INITIAL_ANGLE-angle),Math.cos(INITIAL_ANGLE-angle));goal.tilt=INITIAL_TILT;goal.zoom=1;goal.east=goal.north=0;repaint();}
    const observer=new ResizeObserver(resize);observer.observe(frame);
    const visibility=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;lastFrame=0;if(inView)repaint();});visibility.observe(frame);
    function atEvent(e){const rect=canvas.getBoundingClientRect();return [e.clientX-rect.left,e.clientY-rect.top];}
    function hitAt(x,y){return [...hit].reverse().find(({box:b})=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);}
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,atEvent(e));canvas.style.cursor='grabbing';
      if(pointers.size===1){start=atEvent(e);dragged=false;multi=false;}else{multi=true;dragged=true;}
    },events);
    canvas.addEventListener('pointermove',e=>{
      const pos=atEvent(e), last=pointers.get(e.pointerId);
      if(!last){const item=hitAt(...pos);hovered=item?(item.row?.id??null):undefined;canvas.style.cursor=item?'pointer':'grab';repaint();return;}
      if(pointers.size===2){
        const [other]=[...pointers].find(([id])=>id!==e.pointerId)??[];
        const b=pointers.get(other);if(b){const d0=Math.hypot(last[0]-b[0],last[1]-b[1]),d1=Math.hypot(pos[0]-b[0],pos[1]-b[1]);if(d0>6&&d1>6)zoomBy(d1/d0);}
      }else if(!multi){
        if(!dragged && Math.hypot(pos[0]-start[0],pos[1]-start[1])>3)dragged=true;
        if(dragged){hovered=undefined;goal.angle+=(pos[0]-last[0])*.008;goal.tilt=clamp(goal.tilt+(pos[1]-last[1])*.006,.29,1.15);repaint();}
      }
      pointers.set(e.pointerId,pos);
    },events);
    function release(e){
      if(!pointers.has(e.pointerId))return;
      const pos=atEvent(e);pointers.delete(e.pointerId);
      if(e.type==='pointerup'&&!dragged&&!multi){const item=hitAt(...pos);if(item)choose(item.row);}
      if(!pointers.size){multi=false;start=null;canvas.style.cursor=hitAt(...pos)?'pointer':'grab';}
    }
    canvas.addEventListener('pointerleave',()=>{hovered=undefined;repaint();},events);
    canvas.addEventListener('pointerup',release,events);canvas.addEventListener('pointercancel',release,events);
    canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(-Math.sign(e.deltaY)*.12));},{...events,passive:false});
    canvas.addEventListener('keydown',e=>{
      if(e.key==='Home')reset();else if(e.key==='+'||e.key==='=')zoomBy(1.2);else if(e.key==='-')zoomBy(1/1.2);
      else if(e.key==='ArrowLeft')goal.angle-=.15;else if(e.key==='ArrowRight')goal.angle+=.15;
      else if(e.key==='ArrowDown')goal.tilt=clamp(goal.tilt+.08,.29,1.15);else if(e.key==='ArrowUp')goal.tilt=clamp(goal.tilt-.08,.29,1.15);
      else if(e.key==='Enter' && pins.length){const idx=pins.findIndex(p=>p.row.id===selected?.id);choose(pins[(idx+1)%pins.length].row);}
      else if(e.key==='Escape')choose(null);else return;
      e.preventDefault();repaint();
    },events);
    resize();
    return {update,zoomBy,reset,resize,focusStation,setPlaying,destroy(){destroyed=true;relief.onload=null;visibility.disconnect();controller?.abort();signal.abort();observer.disconnect();cancelAnimationFrame(nextPaint);frame.remove();background=null;}};
  }
  window.GridTerritory=Object.freeze({mount});
})();
